const FileSystem = require('fs');
const fs = FileSystem.promises;
const path = require('path');

module.exports = {
    getProjects,
    addBuild,
    generateHTML,
    generateBadge,
    clearWorkspace,
    clearFolder,
    isValid
}

/**
 * This will return a Promise that resolves to an Array of Jobs
 *
 * @param  {Boolean} logging Whether the internal activity should be logged
 * @return {Promise}         A Promise that resolves to an Array of Jobs
 */
function getProjects(logging) {
    return new Promise((resolve, reject) => {
        fs.readFile(path.resolve(__dirname, "../resources/repos.json")).then((data) => {
            var jobs = [];
            var json = JSON.parse(data);

            for (var repo in json) {
                if (logging) console.log("-> Found Project \"" + repo + "\"");

                var job = {
                    "author": repo.split("/")[0],
                    "repo": repo.split('/')[1].split(":")[0],
                    "branch": repo.split('/')[1].split(":")[1]
                };

                jobs.push(job);
            }

            resolve(jobs);
        }, reject);
    });
}

/**
 * This method adds the current job to the builds.json file and applies any Tags
 *
 * @param  {[type]}  job     The job to add
 * @param  {Boolean} logging Whether the internal activity should be logged
 * @return {Promise}         A Promise that resolves to an Array of Jobs
 */
function addBuild(job, logging) {
    return new Promise((resolve, reject) => {
        if (!isValid(job, true)) {
            reject("Invalid Job");
            return;
        }

        var file = path.resolve(__dirname, "../" + job.author + "/" + job.repo + "/" + job.branch + "/builds.json");
        var builds = {};

        var append = () => {
            if (logging) console.log("-> Adding Build #" + job.id);

            builds[job.id] = {
                id: job.id,
                sha: job.commit.sha,
                date: job.commit.date,
                timestamp: job.commit.timestamp,
                message: job.commit.message,
                author: job.commit.author,
                avatar: job.commit.avatar,
                license: job.license,
                candidate: "DEVELOPMENT",
                status: (job.success ? "SUCCESS": "FAILURE")
            }

            if (job.success) builds.last_successful = job.id;

            builds.latest = job.id;

            // Apply any Tags
            for (let build in builds) {
                for (let tag in job.tags) {
                    if (job.tags[tag] === builds[build].sha) {
                        builds[build].candidate = "RELEASE";
                        builds[build].tag = tag;
                        break;
                    }
                }
            }

            if (logging) console.log("-> Saving 'builds.json'...");
            fs.writeFile(file, JSON.stringify(builds), "utf8").then(resolve, reject);
        }

        if (logging) console.log("-> Reading 'builds.json'...");

        if (FileSystem.existsSync(file)) {
            fs.readFile(file, "utf8").then((data) => {
                builds = JSON.parse(data);
                append();
            }, append);
        }
        else append();
    });
}

/**
 * This method will generate an index.html page for the specified project.
 * It will use '/resources/template.html' as a template.
 *
 * @param  {Object} job      The currently handled Job Object
 * @param  {Boolean} logging Whether the internal activity should be logged
 * @return {Promise}         A promise that resolves when this activity finished
 */
function generateHTML(job, logging) {
    if (logging) console.log("-> Generating 'index.html'...");

    return new Promise((resolve, reject) => {
        if (!isValid(job)) {
            reject("Invalid Job");
            return;
        }

        fs.readFile(path.resolve(__dirname, "../resources/template.html"), "utf8").then((html) => {
            html = html.replace(/\${owner}/g, job.author);
            html = html.replace(/\${repository}/g, job.repo);
            html = html.replace(/\${branch}/g, job.branch);

            if (logging) console.log("-> Saving 'index.html'...");

            fs.writeFile(path.resolve(__dirname, "../" + job.author + "/" + job.repo + "/" + job.branch + "/index.html"), html, "utf8").then(resolve, reject);
        }, reject);
    });
}

/**
 * This method will generate a new badge for the specified project.
 * It will use '/resources/badge.svg' as a template.
 *
 * @param  {Object} job      The currently handled Job Object
 * @param  {Boolean} logging Whether the internal activity should be logged
 * @return {Promise}         A promise that resolves when this activity finished
 */
function generateBadge(job, logging) {
    if (logging) console.log("-> Generating 'badge.svg'...");

    return new Promise((resolve, reject) => {
        if (!isValid(job)) {
            reject("Invalid Job");
            return;
        }

        fs.readFile(path.resolve(__dirname, "../resources/badge.svg"), "utf8").then((svg) => {
            svg = svg.replace(/\${status}/g, job.success ? "SUCCESS": "FAILURE");
            svg = svg.replace(/\${color}/g, job.success ? "rgb(30, 220, 30)": "rgb(220, 30, 30)");

            if (logging) console.log("-> Saving 'badge.svg'...");

            fs.writeFile(path.resolve(__dirname, "../" + job.author + "/" + job.repo + "/" + job.branch + "/badge.svg"), svg, "utf8").then(resolve, reject);
        }, reject);
    });
}

/**
 * This method will delete a project's working directory and source files
 *
 * @param  {Object} job      The currently handled Job Object
 * @param  {Boolean} logging Whether the internal activity should be logged
 * @return {Promise}         A promise that resolves when this activity finished
 */
function clearWorkspace(job, logging) {
    if (!isValid(job, false)) return Promise.reject("Invalid Job!");

    if (!FileSystem.existsSync(path.resolve(__dirname, "../" + job.author + "/" + job.repo + "/" + job.branch + "/files"))) return Promise.resolve();
    else return clearFolder(path.resolve(__dirname, "../" + job.author + "/" + job.repo + "/" + job.branch + "/files"), logging)
}

/**
 * This method will delete a directory recursively.
 *
 * @param  {String} file      The directory to be deleted
 * @param  {Boolean} logging  Whether the internal activity should be logged
 * @return {Promise}          A promise that resolves when this activity finished
 */
function clearFolder(file, logging) {
    if (logging) console.log("-> Deleting '" + path + "'");

    return new Promise((resolve, reject) => {
        FileSystem.stat(file, function(error, stats) {
            if (error) {
                reject(error);
            }
            else if (stats.isFile()) {
                FileSystem.unlink(file, function(err) {
                    if (err) {
                        reject(err);
                    }
                    else{
                        resolve();
                    }
                });
            }
            else if (stats.isDirectory()) {
                FileSystem.readdir(file, function(err, files) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        var length = files.length;
                        var index = 0;

                        function check() {
                            if(length === index) {
                                FileSystem.rmdir(file, function(e) {
                                    if(e) {
                                        reject(e);
                                    }
                                    else {
                                        resolve();
                                    }
                                });
                                return true;
                            }
                            return false;
                        }

                        if(!check()) {
                            var next = () => {
                                index++;
                                check();
                            };

                            var cancel = (e) => {
                                reject(e);
                                i = length;
                            };

                            for (var i = 0; i < length; i++) {
                                clearFolder(file + '/' + files[i], logging).then(next, cancel);
                            }
                        }
                    }
                });
            }
        });
    })
}

/**
 * This method will check if a Job is valid.
 * null / undefined or incomplete Job Objects will fail.
 *
 * @param  {Object}  job        The job object to be tested
 * @param  {Boolean} compiled   Whether to check if the job has an ID and success-value
 * @return {Boolean}            Whether the job is a valid Job
 */
function isValid(job, compiled) {
    if (!job) return false;
    if (Object.getPrototypeOf(job) !== Object.prototype) return false;
    if (!(typeof job.author === 'string' || job.author instanceof String)) return false;
    if (!(typeof job.repo === 'string' || job.repo instanceof String)) return false;
    if (!(typeof job.branch === 'string' || job.branch instanceof String)) return false;

    if (compiled) {
        if (!Number.isInteger(job.id)) return false;
        if (typeof job.success !== "boolean") return false;
    }

    return true;
}
