const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");

const dotenv = require("dotenv");
dotenv.config();
const token = process.env.TOKEN;

const octokit = new Octokit({
  auth: token,
});

// Function to fetch the contributor data from the GitHub API
async function fetchContributorData(owner, repo) {
  try {
    // default values sort=created & direction=desc & page=1
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/stats/contributors",
      { owner, repo }
    );

    console.log("res: ", res);

    if (res.status === 202) {
      // If the response is a 202 (Accepted) status, retry the API call after a delay
      console.log("Received 202 status. Retrying in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchContributorData(owner, repo);
    }

    let contributors = [];

    if (res.data && Array.isArray(res.data)) {
      contributors = res.data;
    }

    const commits = contributors.map((contributor) => contributor.total);
    const highestCommits = Math.max(...commits);
    const normalizedCommits = commits.map((count) => count / highestCommits);
    const totalCommits = normalizedCommits.reduce(
      (total, count) => total + count,
      0
    );

    // 1. Mean
    let mean = 0;
    if (commits.length) mean = totalCommits / normalizedCommits.length;

    // 2. Median
    const sortedCommits = [...normalizedCommits].sort((a, b) => a - b);
    let median = 0;
    if (commits.length)
      median = sortedCommits[Math.floor(sortedCommits.length / 2)];

    // 3. Range
    let range = 0;
    if (commits.length)
      range = sortedCommits[sortedCommits.length - 1] - sortedCommits[0];

    // 4. Quartiles
    const q1Index = Math.floor(sortedCommits.length / 4);
    const q2Index = Math.floor(sortedCommits.length / 2);
    const q3Index = Math.floor((3 * sortedCommits.length) / 4);
    let q1 = 0;
    let q2 = 0;
    let q3 = 0;
    if (sortedCommits.length) {
      q1 = sortedCommits[q1Index];
      q2 = sortedCommits[q2Index];
      q3 = sortedCommits[q3Index];
    }

    // 5. Standard Deviation
    let standardDeviation = 0;
    if (normalizedCommits.length) {
      const deviations = normalizedCommits.map((count) => count - mean);
      const squaredDeviations = deviations.map((deviation) => deviation ** 2);
      const variance =
        squaredDeviations.reduce((total, deviation) => total + deviation, 0) /
        normalizedCommits.length;
      standardDeviation = Math.sqrt(variance);
    }

    console.log("Mean:", mean);
    console.log("Median:", median);
    console.log("Range:", range);
    console.log("Quartiles:", q1, q2, q3);
    console.log("Standard Deviation:", standardDeviation);
    console.log("totalContributors:", contributors.length);

    return {
      mean,
      median,
      range,
      q1,
      q2,
      q3,
      standardDeviation,
      totalContributors: contributors.length,
    };
  } catch (error) {
    console.error(
      `Error fetching contrubutor data for ${owner}/${repo}:`,
      error
    );

    return {
      mean: 0,
      median: 0,
      range: 0,
      q1: 0,
      q2: 0,
      q3: 0,
      standardDeviation: 0,
      totalContributors: 0,
    };
  }
}

async function test() {
  var response = await fetchContributorData("chalk", "chalk");
  console.log(response);
}

// Read merged_records.csv
const mergedRecords = [];
fs.createReadStream("merged_records.csv")
  .pipe(csv())
  .on("data", (data) => mergedRecords.push(data))
  .on("end", async () => {
    // Add new columns for licensing and readme
    const updatedMergedRecords = [];
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
        const {
          mean,
          median,
          range,
          q1,
          q2,
          q3,
          standardDeviation,
          totalContributors,
        } = await fetchContributorData(owner, repo);

        // Add the new columns to the record
        const updatedRecord = {
          Name,
          "Package URL": packageUrl,
          Github,
          ecosystem,
          mean,
          median,
          range,
          q1,
          q2,
          q3,
          standardDeviation,
          totalContributors,
        };

        updatedMergedRecords.push(updatedRecord);
      } catch (error) {
        console.error(`Error processing record: ${error}, ${packageUrl}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream("community_participation_records.csv");
    stream.write(
      "Name,Package URL,Github,ecosystem,Mean,Median,Range,q1,q2,q3,Std,totalContributors\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
        mean,
        median,
        range,
        q1,
        q2,
        q3,
        standardDeviation,
        totalContributors,
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${mean},${median},${range},${q1},${q2},${q3},${standardDeviation},${totalContributors}\n`
      );
    }

    stream.end();
    console.log(
      "Updated merged records written to community_participation_records.csv"
    );
  });
