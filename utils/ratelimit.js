const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config();
const token = process.env.TOKEN;

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
  auth: token,
});

async function checklimit() {
  const { data } = await octokit.request("GET /rate_limit");
  console.log(data);
}
checklimit();
