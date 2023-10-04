const fs = require("fs");
const csv = require("csv-parser");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
  auth: "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",
});

// Function to fetch the community profile from the GitHub API
async function fetchCommunityProfile(owner, repo) {
  try {
    // default values sort=created & direction=desc & page=1
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/community/profile",
      { owner, repo }
    );

    const { health_percentage, files = {} } = data;
    const description = !!data.description;
    const readme = !!files.readme;
    const code_of_conduct = !!files.code_of_conduct;
    const contributing = !!files.contributing;
    const license = !!files.license;
    const pull_request_template = !!files.pull_request_template;
    const admin_accepts_content_report = !!data.content_reports_enabled;

    return {
      health_percentage,
      description,
      readme,
      code_of_conduct,
      contributing,
      license,
      pull_request_template,
      admin_accepts_content_report,
    };
  } catch (error) {
    console.error(
      `Error fetching community profile for ${owner}/${repo}:`,
      error
    );

    return {
      health_percentage: 0,
      description: false,
      readme: false,
      code_of_conduct: false,
      contributing: false,
      license: false,
      pull_request_template: false,
      admin_accepts_content_report: false,
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
    const updatedMergedRecords = [];

    for (const record of mergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github = "",
        ecosystem,
      } = record;

      try {
        // Extract owner and repo from the GitHub URL
        const url = new URL(Github);
        const [owner, repo] = url.pathname.slice(1).split("/");
        // Fetch community profile from GitHub API
        const {
          health_percentage,
          description,
          readme,
          code_of_conduct,
          contributing,
          license,
          pull_request_template,
          admin_accepts_content_report,
        } = await fetchCommunityProfile(owner, repo);

        // Add the new columns to the record
        const updatedRecord = {
          Name,
          "Package URL": packageUrl,
          Github,
          ecosystem,
          health_percentage,
          description,
          readme,
          code_of_conduct,
          contributing,
          license,
          pull_request_template,
          admin_accepts_content_report,
        };

        updatedMergedRecords.push(updatedRecord);
      } catch (error) {
        console.error(`Error processing record: ${error}, ${packageUrl}`);
      }
    }

    // Write the updated merged dataset to a new CSV file
    const stream = fs.createWriteStream("community_records.csv");
    stream.write(
      "Name,Package URL,Github,ecosystem,health_percentage,description,readme,code_of_conduct,contributing,license,pull_request_template,admin_accepts_content_report\n" // CSV header
    );

    for (const record of updatedMergedRecords) {
      const {
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
        health_percentage,
        description,
        readme,
        code_of_conduct,
        contributing,
        license,
        pull_request_template,
        admin_accepts_content_report,
      } = record;

      stream.write(
        `${Name},${packageUrl},${Github},${ecosystem},${health_percentage},${description},${readme},${code_of_conduct},${contributing},${license},${pull_request_template},${admin_accepts_content_report}\n`
      );
    }

    stream.end();
    console.log("Updated merged records written to community_records.csv");
  });
