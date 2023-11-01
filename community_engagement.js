const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");
// is:pr interactions:1..1000 created:>2022-10-30
const dotenv = require("dotenv");
dotenv.config();
const token = process.env.TOKEN;

const MyOctokit = Octokit.plugin(throttling);

const isGoodFirstIssueLabelExists = (labelsData) => {
  const labels = labelsData
    .map(({ name = "" }) => name)
    .join(" ")
    .toLowerCase();

  const isGoodStringExists =
    labels.includes("good first issue") ||
    labels.includes("good first pull request");

  return isGoodStringExists;
};

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

// Calculate the date 3 days ago from the current date
const perPagePRs = 100;
const limitDate = new Date();
limitDate.setDate(limitDate.getDate() - 365);

async function fetchPRs(owner, repo, page = 1, records = []) {
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

    const res = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "all",
      sort: "created",
      direction: "desc",
      per_page: perPagePRs,
      page,
    });

    if (res.status === 200) {
      console.log("Size: ", records.length, res.data.length);
      if (res.data.length === 0) {
        // No more pull requests to fetch
        return records;
      }

      for (const item of res.data) {
        const createdDate = new Date(item.created_at);
        if (createdDate < limitDate) {
          // If a pull request is older than 3 days, stop fetching
          return records;
        }

        records.push({
          title: item.title,
          id: item.id,
          number: item.number,
          userlogin: item.user.login,
          usertype: item.user.type,
          author_association: item.author_association,
          created_at: item.created_at,
          state: item.state,
          isGoodFirstLabelExists: isGoodFirstIssueLabelExists(item.labels),
        });
      }

      // Recursively fetch the next page of pull requests
      return fetchPRs(owner, repo, page + 1, records);
    } else {
      console.error("Error fetching PRs:", res.status, owner, repo);
      return records;
    }
  } catch (error) {
    console.error("Error fetching PRs:", error, owner, repo);
    // Handle errors, including rate limit exceeded
    if (error.status === 403 && error.headers && error.headers["retry-after"]) {
      const retryAfter = parseInt(error.headers["retry-after"], 10);
      console.warn(`Rate limit exceeded. Waiting for ${retryAfter} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      // Retry the request recursively
      return fetchPRs(owner, repo, page, records);
    } else {
      return records;
    }
  }
}

// Read merged_records.csv
const mergedRecords = [];
fs.createReadStream("merged_records_just_for_testing.csv")
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

      i = i + 1;
      try {
        // Extract owner and repo from the GitHub URL
        const url = new URL(Github);
        const [owner, repo] = url.pathname.slice(1).split("/");
        console.log("Index: " + i, owner, repo);
        // Fetch community profile from GitHub API
        const records = await fetchPRs(owner, repo);

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
    const stream = fs.createWriteStream("community_engagement_records.csv");
    stream.write(
      "Name,Package URL,Github,ecosystem,id,number,userlogin,usertype,author_association,created_at,state,isGoodFirstLabelExists\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
        id,
        number,
        userlogin,
        usertype,
        author_association,
        created_at,
        state,
        isGoodFirstLabelExists,
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${id},${number},${userlogin},${usertype},${author_association},${created_at},${state},${isGoodFirstLabelExists}\n`
      );
    }

    stream.end();
    console.log(
      "Updated merged records written to community_engagement_records.csv"
    );
  });
