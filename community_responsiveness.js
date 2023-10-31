const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");

const dotenv = require("dotenv");
dotenv.config();
const token = process.env.TOKEN;

const MyOctokit = Octokit.plugin(throttling);

const octokit = new MyOctokit({
  auth: token,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      console.warn(
        `Rate limit exceeded for ${options.method} ${options.url}. Waiting for ${retryAfter} seconds...`
      );
      return true;
    },
    onAbuseLimit: (retryAfter, options) => {
      console.warn(
        `Abuse limit reached for ${options.method} ${options.url}. Waiting for ${retryAfter} seconds...`
      );
      return true;
    },
    onSecondaryRateLimit: (retryAfter, options) => {
      console.warn(
        `Secondary rate limit exceeded for ${options.method} ${options.url}. Waiting for ${retryAfter} seconds...`
      );
      return true;
    },
  },
});

// https://docs.github.com/en/graphql/reference/enums#commentauthorassociation

const COMMENT_AUTHOR_ASSOCIATION = [
  "COLLABORATOR",
  "CONTRIBUTOR",
  "FIRST_TIMER",
  "FIRST_TIME_CONTRIBUTOR",
  "MANNEQUIN",
  "MEMBER",
  "NONE",
  "OWNER",
];

// "CONTRIBUTOR" has been removed from the INSIDER LIST

const INSIDER = ["COLLABORATOR", "MEMBER", "OWNER"];
const perPageIssues = 100; // You can set this to the maximum of 100
const perPageComments = 100; // You can set this to the maximum of 100
const issuePageLimit = 2;
async function fetchIssues(owner, repo, page = 1) {
  try {
    // Add rate limit check before making the request
    const rateLimit = await octokit.rateLimit.get();
    const coreLimit = rateLimit.data.resources.core;
    if (coreLimit.remaining < 1) {
      const resetTime = new Date(coreLimit.reset * 1000);
      const now = new Date();
      const timeUntilReset = resetTime - now;
      console.log(
        `Rate limit exhausted. Waiting for ${timeUntilReset / 1000} seconds...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, timeUntilReset + 1000)
      ); // Add an extra second to be safe
    }

    // default values sort=created & direction=desc & page=1
    const res = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner,
      repo,
      sort: "created", // Sort by creation date (default)
      direction: "desc", // Sort in descending order (default)
      per_page: perPageIssues,
      page,
    });

    if (res.status === 200) {
      if (res.data.length === 0) {
        // No more Issues to fetch
        return [];
      }

      const records = [];

      for (const {
        number,
        author_association,
        created_at,
        comments = 0,
      } of res.data) {
        const openByOutsider = !INSIDER.includes(author_association);

        let row = {
          number,
          created_at,
          openByOutsider,
          comments,
          returnByInsider: false,
          reply_at: "",
        };

        if (comments > 0) {
          const { returnByInsider = false, reply_at = "" } =
            await fetchComments(owner, repo, number);

          row = {
            ...row,
            returnByInsider,
            reply_at,
          };
        }
        records.push(row);
      }

      if (page >= issuePageLimit) {
        return records;
      }

      // Fetch the next page of Issues
      const nextPageRecords = await fetchIssues(owner, repo, page + 1);

      return records.concat(nextPageRecords);
    }
    return [];
  } catch (error) {
    console.error("Error fetching Issues:", error, owner, repo);
    // Handle errors, including rate limit exceeded
    console.error("Error fetching Issues:", error, owner, repo);
    if (error.status === 403 && error.headers && error.headers["retry-after"]) {
      const retryAfter = parseInt(error.headers["retry-after"], 10);
      console.warn(`Rate limit exceeded. Waiting for ${retryAfter} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return fetchIssues(owner, repo, page); // Retry the request
    }

    return [];
  }
}

async function fetchComments(owner, repo, issue_number) {
  try {
    // default values sort=created & direction=desc & page=1
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner,
        repo,
        issue_number,
        per_page: perPageComments,
        page: 1,
      }
    );

    let returnByInsider = false;
    let reply_at = "";
    if (res.status === 200) {
      const index = res.data.findIndex(({ author_association }) =>
        INSIDER.includes(author_association)
      );
      if (index !== -1) {
        returnByInsider = true;
        reply_at = res.data[index].created_at;
      }
    }
    return {
      returnByInsider,
      reply_at,
    };
  } catch (error) {
    console.error("Error fetching Comnets:", error, owner, repo, issue_number);
    return {
      returnByInsider: false,
      reply_at: "",
    };
  }
}

// Read merged_records.csv
const mergedRecords = [];
fs.createReadStream("merged_records.csv")
  .pipe(csv())
  .on("data", (data) => mergedRecords.push(data))
  .on("end", async () => {
    // Add new columns for licensing and readme
    let updatedMergedRecords = [];
    let i = 0;
    for (const record of mergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github = "",
        ecosystem,
      } = record;

      console.log("Index: " + i);
      i = i + 1;
      try {
        // Extract owner and repo from the GitHub URL
        const url = new URL(Github);
        const [owner, repo] = url.pathname.slice(1).split("/");
        // Fetch community profile from GitHub API
        const records = await fetchIssues(owner, repo);

        // Add the new columns to the record
        const updatedRecords = records.map((record) => {
          return {
            Name,
            "Package URL": packageUrl,
            Github,
            ecosystem,
            ...record,
          };
        });

        updatedMergedRecords = [...updatedMergedRecords, ...updatedRecords];
      } catch (error) {
        console.error(`Error processing record: ${error}, ${packageUrl}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream(
      "community_responsiveness_records_full.csv"
    );
    stream.write(
      "Name,Package URL,Github,ecosystem,number,created_at,openByOutsider,comments,returnByInsider,reply_at\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
        number,
        created_at,
        openByOutsider,
        comments,
        returnByInsider,
        reply_at,
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${number},${created_at},${openByOutsider},${comments},${returnByInsider},${reply_at}\n`
      );
    }

    stream.end();
    console.log(
      "Updated merged records written to community_responsiveness_records.csv"
    );
  });
