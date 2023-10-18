const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");

const dotenv = require("dotenv");
dotenv.config();
const token = process.env.TOKEN;

const octokit = new Octokit({
  auth: token,
});

// Function to fetch Labels to see good first issue; good for new comers
async function fetchLabelsData(owner, repo) {
  try {
    // default values sort=created & direction=desc & page=1
    const res = await octokit.request("GET /repos/{owner}/{repo}/labels", {
      owner,
      repo,
      per_page: 100,
      page: 1,
    });

    if (res.data && Array.isArray(res.data)) {
      const labels = res.data
        .map(({ name = "" }) => name)
        .join(" ")
        .toLowerCase();

      const isGoodStringExists =
        labels.includes("good first issue") ||
        labels.includes("good first pull request");
      console.log("Name:", repo, "  isGoodStringExists:", isGoodStringExists);

      return isGoodStringExists;
    }
    return false;
  } catch {
    return false;
  }
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
        const goodFirstIssue = await fetchLabelsData(owner, repo);

        // Add the new columns to the record
        const updatedRecord = {
          Name,
          "Package URL": packageUrl,
          Github,
          ecosystem,
          goodFirstIssue,
        };

        updatedMergedRecords.push(updatedRecord);
      } catch (error) {
        console.error(`Error processing record: ${error}, ${packageUrl}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream("community_welcomeness_records.csv");
    stream.write(
      "Name,Package URL,Github,ecosystem,goodFirstIssue\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
        goodFirstIssue,
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${goodFirstIssue}\n`
      );
    }

    stream.end();
    console.log(
      "Updated merged records written to community_welcomeness_records.csv"
    );
  });
