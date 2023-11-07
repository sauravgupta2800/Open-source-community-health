const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");
// is:pr interactions:1..1000 created:>2022-10-30
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

async function searchPullRequests(
  username = "sauravgupta2800",
  date = "2014-11-01T01:12:04Z"
) {
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

    const response = await octokit.request("GET /search/issues", {
      q: `is:pr author:${username} created:<${date}`,
      per_page: 1,
    });

    let havePr = true;
    let total_count = -1;
    if (response.status === 200) {
      if (response && response.data) {
        total_count = response.data.total_count;
        console.log(response.data.total_count, response.data.items.length);
        havePr = total_count == 0;
      }
    }
    return { havePr, total_count };
  } catch (error) {
    console.error("Error fetching PRs:", error, username);
    // Handle errors, including rate limit exceeded
    if (error.status === 403 && error.headers && error.headers["retry-after"]) {
      const retryAfter = parseInt(error.headers["retry-after"], 10);
      console.warn(`Rate limit exceeded. Waiting for ${retryAfter} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      // Retry the request recursively
      return searchPullRequests(username, date);
    } else {
      return { havePr: true, total_count: -1 };
    }
  }
}

// Read community_first_ever_contribution_unique_userlogin.csv
// Make sure run "community_first_ever_contribution_preprocess.ipynb first to have this csv"
const mergedRecords = [];
fs.createReadStream("community_first_ever_contribution_unique_userlogin.csv")
  .pipe(csv())
  .on("data", (data) => mergedRecords.push(data))
  .on("end", async () => {
    let updatedMergedRecords = [];
    let i = 0;
    for (const record of mergedRecords) {
      console.log(record);
      const { userlogin, created_at, ecosystem } = record;

      i = i + 1;
      try {
        console.log("Index: " + i, userlogin, created_at);
        const { havePr, total_count } = await searchPullRequests(
          userlogin,
          created_at
        );

        // Add the new columns to the record
        updatedMergedRecords.push({
          userlogin,
          created_at,
          havePr,
          total_count,
          ecosystem,
        });
      } catch (error) {
        console.error(`Error processing record: ${userlogin}, ${created_at}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream(
      "community_first_ever_contribution.csv"
    );
    stream.write(
      "userlogin,created_at,havePr,total_count,ecosystem\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const { userlogin, created_at, havePr, total_count, ecosystem } = record;

      stream.write(
        `${userlogin},${created_at},${havePr},${total_count},${ecosystem}\n`
      );
    }

    stream.end();
    console.log(
      "Updated merged records written to community_first_ever_contribution.csv"
    );
  });

searchPullRequests();
