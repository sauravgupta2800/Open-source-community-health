const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
  auth: "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",
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

    let contributors = [];

    if (res.data && Array.isArray(res.data)) {
      contributors = res.data;
    }

    const commits = contributors.map((contributor) => contributor.total);
    const totalCommits = commits.reduce((total, count) => total + count, 0);
    // Calculate contribution percentages and sort in descending order
    const contributionPercentages = commits.map(
      (count) => (count / totalCommits) * 100
    );

    contributionPercentages.sort((a, b) => b - a);

    // 1. Mean
    let mean = 0;
    if (commits.length) mean = totalCommits / commits.length;

    // 2. Median
    const sortedCommits = [...commits].sort((a, b) => a - b);
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
    if (commits.length) {
      q1 = sortedCommits[q1Index];
      q2 = sortedCommits[q2Index];
      q3 = sortedCommits[q3Index];
    }

    // 5. Standard Deviation
    let standardDeviation = 0;
    if (commits.length) {
      const deviations = commits.map((count) => count - mean);
      const squaredDeviations = deviations.map((deviation) => deviation ** 2);
      const variance =
        squaredDeviations.reduce((total, deviation) => total + deviation, 0) /
        commits.length;
      standardDeviation = Math.sqrt(variance);
    }

    console.log("Mean:", mean);
    console.log("Median:", median);
    console.log("Range:", range);
    console.log("Quartiles:", q1, q2, q3);
    console.log("Standard Deviation:", standardDeviation);

    return { mean, median, range, q1, q2, q3, standardDeviation };
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
    };
  }
}

// fetchContributorData("yargs", "yargs");

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
        const { mean, median, range, q1, q2, q3, standardDeviation } =
          await fetchContributorData(owner, repo);

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
        };

        updatedMergedRecords.push(updatedRecord);
      } catch (error) {
        console.error(`Error processing record: ${error}, ${packageUrl}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream("contributor_records.csv");
    stream.write(
      "Name,Package URL,Github,ecosystem,Mean,Median,Range,q1,q2,q3,Std\n" // CSV header
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
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${mean},${median},${range},${q1},${q2},${q3},${standardDeviation}\n`
      );
    }

    stream.end();
    console.log("Updated merged records written to contributor_records.csv");
  });
