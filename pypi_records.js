const axios = require("axios");
const fs = require("fs");

async function fetchPackageDetails() {
  try {
    const response = await axios.get(
      "https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.json"
    );
    const packages = response.data.rows.slice(0, 1000);

    // console.log(packages);

    const csvData = [];
    let index = 0;
    for (const package of packages) {
      try {
        const packageResponse = await axios.get(
          `https://pypi.org/pypi/${package.project}/json`
        );
        index++;
        const packageData = packageResponse.data;

        const packageDetail = {
          name: packageData.info.name,
          url:
            packageData.info.project_url ||
            packageData.info.project_urls.Homepage ||
            "",
          github:
            packageData.info.project_urls.Source ||
            packageData.info.project_urls["Source Code"] ||
            packageData.info.project_urls["Source code"] ||
            packageData.info.project_urls["source code"] ||
            packageData.info.project_urls["Homepage"] ||
            packageData.info.project_urls["homepage"] ||
            packageData.info.project_urls["Home"] ||
            packageData.info.project_urls["GitHub"] ||
            packageData.info.project_urls["Code"] ||
            packageData.info.project_urls["Project"] ||
            packageData.info.project_urls["Repository"] ||
            packageData.info.project_urls["Issue Tracker"] ||
            packageData.info.project_urls["repository"] ||
            packageData.info.project_urls["Issue Tracker"] ||
            packageData.info.project_urls["Changelog"] ||
            packageData.info.project_urls["Bug Tracker"] ||
            packageData.info.project_urls["Download"] ||
            "",
          downloads: package.download_count,
        };

        console.log(index);

        csvData.push(packageDetail);
      } catch (error) {
        console.error(
          `Error fetching package details for ${package.package_name}:`,
          error.message
        );
      }
    }

    // Write data to CSV file
    const csvWriter = fs.createWriteStream("pypi_records.csv");
    csvWriter.write("Name,Package URL,Github,Downloads\n");
    csvData.forEach((record) => {
      const { name, url, github, downloads } = record;
      csvWriter.write(`${name},${url},${github},${downloads}\n`);
    });
    csvWriter.end();

    console.log("CSV file has been written successfully.");
  } catch (error) {
    console.error("Error fetching package list:", error.message);
  }
}

fetchPackageDetails();
