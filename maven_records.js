const axios = require("axios");
const fs = require("fs");

// Function to fetch the most popular Ruby gems libraries based on downloads
async function fetchData() {
  const apiUrl =
    "https://packages.ecosyste.ms/api/v1/registries/repo1.maven.org/packages";
  const perPage = 50;
  const totalRecords = 1000;

  let allRecords = [];

  const totalPages = Math.ceil(totalRecords / perPage);

  for (let page = 1; page <= totalPages; page++) {
    const params = {
      sort: "dependent_repos_count",
      page,
      per_page: perPage,
      order: "desc",
    };
    try {
      const response = await axios.get(apiUrl, { params });

      const records = response.data;
      allRecords = allRecords.concat(records);
      console.log(allRecords.length);
      //   console.log(gems.map(({ name }) => name));
      //   console.log(gems.length);
    } catch (error) {
      console.error("Error fetching gems:", error);
    }
  }

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
