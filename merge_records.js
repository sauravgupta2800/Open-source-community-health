const fs = require("fs");
const csv = require("csv-parser");

// Function to filter the records based on valid GitHub URLs
function filterRecords(records, ecosystem) {
  const filteredRecords = [];
  let count = 0;

  for (const record of records) {
    const { Name, "Package URL": packageUrl, Github } = record;

    if (Github && Github.startsWith("https://github.com/")) {
      filteredRecords.push({
        Name,
        "Package URL": packageUrl,
        Github,
        ecosystem,
      });

      count++;
    }
  }

  return filteredRecords;
}

// Read npm_records.csv
const npmRecords = [];
fs.createReadStream("npm_records.csv")
  .pipe(csv())
  .on("data", (data) => npmRecords.push(data))
  .on("end", () => {
    // Filter and limit npm records
    const filteredNpmRecords = filterRecords(npmRecords, "npm");

    // Read pypi_records.csv
    const pypiRecords = [];
    fs.createReadStream("pypi_records.csv")
      .pipe(csv())
      .on("data", (data) => pypiRecords.push(data))
      .on("end", () => {
        // Filter and limit pypi records
        const filteredPypiRecords = filterRecords(pypiRecords, "pypi");

        // Read rubygems_records.csv
        const rubygemsRecords = [];
        fs.createReadStream("rubygems_records.csv")
          .pipe(csv())
          .on("data", (data) => rubygemsRecords.push(data))
          .on("end", () => {
            // Filter and limit rubygems records
            const filteredRubygemsRecords = filterRecords(
              rubygemsRecords,
              "rubygems"
            );

            // Read maven_records.csv
            const mavenRecords = [];
            fs.createReadStream("maven_records.csv")
              .pipe(csv())
              .on("data", (data) => mavenRecords.push(data))
              .on("end", () => {
                // Filter and limit rubygems records
                const filteredMavenRecords = filterRecords(
                  mavenRecords,
                  "maven"
                );

                // Merge the filtered datasets
                const mergedData = [
                  ...filteredNpmRecords,
                  ...filteredPypiRecords,
                  ...filteredRubygemsRecords,
                  ...filteredMavenRecords,
                ];

                // Write the merged dataset to a new CSV file
                const stream = fs.createWriteStream("merged_records.csv");
                stream.write(
                  "Name,Package URL,Github,ecosystem\n" // CSV header
                );

                for (const record of mergedData) {
                  const {
                    Name,
                    "Package URL": packageUrl,
                    Github,
                    ecosystem,
                  } = record;

                  stream.write(
                    `${Name},${packageUrl},${Github},${ecosystem}\n`
                  );
                }

                stream.end();
                console.log("Merged records written to merged_records.csv");
              });
          });
      });
  });
