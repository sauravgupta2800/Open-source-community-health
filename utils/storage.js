const fs = require("fs");
const path = require("path");

class KeyValueStorage {
  constructor(folder = "tmp", filename = "tmp.json") {
    this.folder = folder;
    this.filename = filename;
    this.data = this.load();
  }

  ensureFolderExists() {
    const folderPath = path.resolve(__dirname, this.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  }

  load() {
    this.ensureFolderExists();
    try {
      const filePath = path.resolve(__dirname, this.folder, this.filename);
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      // If the file doesn't exist or is invalid JSON, return an empty object
      return {};
    }
  }

  save() {
    this.ensureFolderExists();
    try {
      const filePath = path.resolve(__dirname, this.folder, this.filename);
      const data = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(filePath, data, "utf8");
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  remove(key) {
    delete this.data[key];
    this.save();
  }

  exits(key) {
    return !!this.data[key];
  }
}

const storage = new KeyValueStorage();

storage.set("name", "Saurav");
storage.set("age", 25);

console.log("Name:", storage.get("name"));
console.log("Age:", storage.get("age"));

// storage.remove("age");

console.log("Age:", storage.get("age"));

module.exports = KeyValueStorage;
