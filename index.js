require('colors');
let merge = require('lodash.merge');

var DeferSpecReporter = function (baseReporterDecorator, formatError, config) {
  baseReporterDecorator(this);

  var reporterCfg = merge({
    suppressPassed: true,
    suppressFailed: false,
    suppressSkipped: true,
    deferred: true
  }, config.deferSpecReporter || {});
  this.prefixes = reporterCfg.prefixes || {
      success: '✓ ',
      failure: '✗ ',
      skipped: '- ',
    };

  if (process && process.platform === 'win32') {
    this.prefixes.success = '\u221A ';
    this.prefixes.failure = '\u00D7 ';
    this.prefixes.skipped = '- ';
  }

  this.deferredOutput = [];
  this.USE_COLORS = false;

  // colorize output of BaseReporter functions
  if (config.colors) {
    this.USE_COLORS = true;
    this.SPEC_FAILURE = '%s %s FAILED'.red + '\n';
    this.SPEC_SLOW = '%s SLOW %s: %s'.yellow + '\n';
    this.ERROR = '%s ERROR'.red + '\n';
    this.FINISHED_ERROR = ' ERROR'.red;
    this.FINISHED_SUCCESS = ' SUCCESS'.green;
    this.FINISHED_DISCONNECTED = ' DISCONNECTED'.red;
    this.X_FAILED = ' (%d FAILED)'.red;
    this.TOTAL_SUCCESS = 'TOTAL: %d SUCCESS'.green + '\n';
    this.TOTAL_FAILED = 'TOTAL: %d FAILED, %d SUCCESS'.red + '\n';
  }

  this.onRunComplete = function (browsers, results) {
    //NOTE: the renderBrowser function is defined in karma/reporters/Base.js
    this.writeCommonMsg('\n' + browsers.map(this.renderBrowser)
        .join('\n') + '\n');

    if (browsers.length >= 1 && !results.disconnected && !results.error) {
      if (!results.failed) {
        this.write(this.TOTAL_SUCCESS, results.success);
      } else {
        this.write(this.TOTAL_FAILED, results.failed, results.success);
        this.logOutput();
      }
    }

    this.write('\n');
    this.currentSuite = [];
  };

  this.logOutput = function() {
    this.deferredOutput.map(deferred => deferred());
    this.deferredOutput = [];
  };

  this.currentSuite = [];
  this.writeSpecMessage = function (status) {
    let toDefer = (function (browser, result) {
      var suite = result.suite;
      var indent = "  ";
      suite.forEach(function (value, index) {
        if (index >= this.currentSuite.length || this.currentSuite[index] != value) {
          if (index === 0) {
            this.writeCommonMsg('\n');
          }

          this.writeCommonMsg(indent + value + '\n');
          this.currentSuite = [];
        }

        indent += '  ';
      }, this);

      this.currentSuite = suite;

      var specName = result.description;
      var elapsedTime = reporterCfg.showSpecTiming ? ' (' + result.time + 'ms)' : '';

      if (this.USE_COLORS) {
        if (result.skipped) specName = specName.cyan;
        else if (!result.success) specName = specName.red;
      }

      var msg = indent + status + specName + elapsedTime;

      result.log.forEach(function (log) {
        if (reporterCfg.maxLogLines) {
          log = log.split('\n').slice(0, reporterCfg.maxLogLines).join('\n');
        }
        msg += '\n' + formatError(log, '\t');
      });

      this.writeCommonMsg(msg + '\n');

      // NOTE: other useful properties
      // browser.id;
      // browser.fullName;
    }).bind(this);

    return (function(browser, result) {
      if (reporterCfg.deferred) this.deferredOutput.push(() => toDefer(browser, result));
      else toDefer(browser, result);
    }).bind(this);
  };

  this.LOG_SINGLE_BROWSER = '%s LOG: %s\n';
  this.LOG_MULTI_BROWSER = '%s %s LOG: %s\n';
  var doLog = config && config.browserConsoleLogOptions && config.browserConsoleLogOptions.terminal;
  this.onBrowserLog = doLog ? function (browser, log, type) {
    if (this._browsers && this._browsers.length === 1) {
      this.write(this.LOG_SINGLE_BROWSER, type.toUpperCase(), this.USE_COLORS ? log.cyan : log);
    } else {
      this.write(this.LOG_MULTI_BROWSER, browser, type.toUpperCase(), this.USE_COLORS ? log.cyan : log);
    }
  } : noop;

  function noop() {
  }

  this.specSuccess = reporterCfg.suppressPassed ? noop : this.writeSpecMessage(this.USE_COLORS ? this.prefixes.success.green : this.prefixes.success);
  this.specSkipped = reporterCfg.suppressSkipped ? noop : this.writeSpecMessage(this.USE_COLORS ? this.prefixes.skipped.yellow : this.prefixes.skipped);
  this.specFailure = reporterCfg.suppressFailed ? noop : this.writeSpecMessage(this.USE_COLORS ? this.prefixes.failure.red : this.prefixes.failure);
  this.showSpecTiming = reporterCfg.showSpecTiming || false;
};

DeferSpecReporter.$inject = ['baseReporterDecorator', 'formatError', 'config'];

module.exports = {
  'reporter:defer-spec': ['type', DeferSpecReporter]
};
