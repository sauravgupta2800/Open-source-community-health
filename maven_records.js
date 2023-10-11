const axios = require("axios");
const fs = require("fs");

// Function to fetch the most popular Ruby gems libraries based on downloads
async function fetchData() {
  const apiUrl =
    "https://packages.ecosyste.ms/api/v1/registries/repo1.maven.org/packages";
  const perPage = 50;
  const totalRecords = 1000;

  let allRecords = [];
  let uniqueRepositories = new Set();

  let page = 0;
  while (allRecords.length < totalRecords) {
    page = page + 1;
    const params = {
      sort: "dependent_repos_count",
      page,
      per_page: perPage,
      order: "desc",
    };
    try {
      const response = await axios.get(apiUrl, { params });

      const records = response.data;
      for (const record of records) {
        if (
          record.repository_url &&
          record.repository_url.startsWith("https://github.com/") &&
          !uniqueRepositories.has(record.repository_url)
        ) {
          allRecords.push(record);
          uniqueRepositories.add(record.repository_url);
        }
      }

      console.log(allRecords.length);
    } catch (error) {
      console.error("Error fetching gems:", error);
    }
  }

  allRecords = allRecords.slice(0, totalRecords);

  console.log("Fetched records:", allRecords.length);

  // Transform records for CSV writing
  const csvData = allRecords.map((record) => ({
    name: record.name,
    url: record.homepage || "N/A",
    github: record.repository_url || "N/A",
    dependent_packages_count: record.dependent_packages_count,
  }));

  // Write data to CSV file
  const csvWriter = fs.createWriteStream("maven_records.csv");
  csvWriter.write("Name,Package URL,Github, Dependent Packages Count\n");
  csvData.forEach((record) => {
    const { name, url, github, dependent_packages_count } = record;
    csvWriter.write(`${name},${url},${github},${dependent_packages_count}\n`);
  });
  csvWriter.end();

  console.log("CSV file has been written successfully.");
}

fetchData();
