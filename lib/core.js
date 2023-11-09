const newman = require('newman');
const files = require('../lib/files');
const fs = require('fs')
const path = require('path');
const rimraf = require('rimraf');
const Promise = require('bluebird')
const chalk = require('chalk');

class NewmanConfig{

    constructor(){
        this.current_path = path.dirname(fs.realpathSync(__filename))
        this.reporters_list = ['cli', 'json', 'html', 'allure']
        this.allure_report_path = './reports/allure'
        this.newman_json_report_path = './reports/json/'
        this.newman_html_report_path = './reports/html/'
    }

    async looprun(root_json_file, series = false, verbose = false){
        console.log('Feed file taken is: ' + root_json_file);
        var root_json = this.get_relative_path(root_json_file)
        var root_file = require(root_json)
        var run_list = root_file.runs
        console.log("!----------------------------------Files Taken to run---------------------------------------!")
        if (series) {
          const reflect = promise => promise.then(completed => ({completed, status: "fulfilled" }), errored => ({errored, status: "rejected" }));
          let results = []
          Promise.each(run_list, data => reflect(this.runCollectionAsync(data.collection, data.environment, data.sslClientKey, data.sslClientCert)).then(res => results.push(res)))
          .then(() => {
            const success = results.filter(r => r.status === 'fulfilled')
            const failed = results.filter(r => r.status === 'rejected')
            console.log(chalk.green.bold(`Passed (${success.length}):`))
            console.log(success.map(res => res.completed.collection))
            console.log(chalk.red.bold(`Failed (${failed.length}):`))
            console.log(failed.map(res => res.errored.collection))
            if (verbose) {
              failed.map(res => {
                const { error, collection } = res.errored;
                console.log("---------------------------------------------------------------------------------------------")
                console.log('Collection:', collection)
                console.log('Error:', error)
              })
            }
            console.log("!-------------------------------------------------------------------------------------------!")
            if (failed.length) {
              process.exit(1)
            }
          })
          return;
        }
        run_list.map(data => {
            if (data.environment == undefined) {
                this.runCollection(data.collection)
            } else {
                this.runCollectionWithEnv(data.collection, data.environment)
            }
        })
        console.log("!-------------------------------------------------------------------------------------------!")
    }

    get_relative_path(abs_path) {
        if (abs_path.startsWith('.')) {
            return path.relative(this.current_path, files.getCurrentDirectoryBase() + abs_path.substring(2))
        } else {
            return path.relative(this.current_path, files.getCurrentDirectoryBase() + abs_path)
        }
    }

    runCollectionAsync(collection, environment, sslClientCert = null, sslClientKey = null){
      return new Promise((resolve, reject) => {
      console.log('Collection file taken to run: ' + collection)
      console.log('Environment file taken to run: ' + environment)
      const _collection = this.get_relative_path(collection)
      environment = this.get_relative_path(environment)
      var file_name = collection.split("/")
      const config = {
          collection: require(_collection),
          reporters: this.reporters_list,
          reporter: {
              html: {
                  export: this.newman_html_report_path.concat(file_name[file_name.length - 1]).concat('.html') // If not specified, the file will be written to `newman/` in the current working directory.
              },
              allure: {
                  export: this.allure_report_path
              },
              json: {
                  export: this.newman_json_report_path.concat(file_name[file_name.length - 1]).concat('.json')
              }
          }
      }
      if (environment !== void(0)) {
        config.environment = require(environment)
      }
      if (sslClientCert !== null) {
        config.sslClientCert = fs.readFileSync(sslClientCert, 'utf8')?.trim();
      }
      if (sslClientKey !== null) {
        config.sslClientKey = fs.readFileSync(sslClientKey, 'utf8')?.trim();
      }
      newman.run(config, function(err, summary) {
        const isError = err || summary.run.error || summary.run.failures.length;
          if (isError) {
            const error = err || summary.run.error || summary.run.failures
            reject({ collection, error })
            console.log('collection run failed!');
          }
          resolve({ collection, config });
      });
    })
  }

    runCollectionWithEnv(collection, environment){
        // call newman.run to pass `options` object and wait for callback
        console.log('Collection file taken to run: ' + collection)
        console.log('Environment file taken to run: ' + environment)
        collection = this.get_relative_path(collection)
        environment = this.get_relative_path(environment)
        var file_name = collection.split("/")
        newman.run({
            collection: require(collection),
            environment: require(environment),
            reporters: this.reporters_list,
            reporter: {
                html: {
                    export: this.newman_html_report_path.concat(file_name[file_name.length - 1]).concat('.html') // If not specified, the file will be written to `newman/` in the current working directory.
                },
                allure: {
                    export: this.allure_report_path
                },
                json: {
                    export: this.newman_json_report_path.concat(file_name[file_name.length - 1]).concat('.json')
                }
            }
        }, function(err, summary) {
            if (err || summary.run.error || summary.run.failures.length) {
                console.log('collection run complete!');
                process.exit(1);
            }
        });
    }

    runCollection(collection){
        // call newman.run to pass `options` object and wait for callback
        console.log('Collection file taken to run: ' + collection)
        collection = this.get_relative_path(collection)
        var file_name = collection.split("/")
        newman.run({
            collection: require(collection),
            reporters: this.reporters_list,
            reporter: {
                html: {
                    export: this.newman_html_report_path.concat(file_name[file_name.length - 1]).concat('.html') // If not specified, the file will be written to `newman/` in the current working directory.
                },
                allure: {
                    export: this.allure_report_path
                },
                json: {
                    export: this.newman_json_report_path.concat(file_name[file_name.length - 1]).concat('.json')
                }
            }
        }, function(err, summary) {
            if (err || summary.run.error || summary.run.failures.length) {
                console.log('collection run complete!');
                process.exit(1);
            }
        });
    }

    removeDirectory(directory) {
        // directory = this.get_relative_path(directory)
        try {
            fs.readdir(directory, (err, files) => {
                if (err) throw err;
                console.log('Removing files from: ' + directory)
                for (const file of files) {
                    if (file != '.keep') {
                        fs.unlink(path.join(directory, file), err => {
                            if (err) {
                                console.log("Cannot clear the files from the directory using rimraf");
                                rimraf(directory + '/*', function () { console.log('done'); });
                            }
                        });
                    }
                }
            });
        }
        catch (e) {
            console.log("Cannot clear the files from the directory using rimraf");
            rimraf(directory + '/*', function () { console.log('done'); });
        }
    }

    clearResultsFolder() {
        this.removeDirectory(files.getCurrentDirectoryBase() + this.allure_report_path)
        this.removeDirectory(files.getCurrentDirectoryBase() + this.newman_html_report_path)
        this.removeDirectory(files.getCurrentDirectoryBase() + this.newman_json_report_path)
    }

}

module.exports = NewmanConfig
