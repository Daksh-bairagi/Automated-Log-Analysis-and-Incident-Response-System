const SpaceDelimitedParser = require('./parsers/SpaceDelimitedParser');
const JsonLogParser = require('./parsers/JsonLogParser');
const SyslogParser = require('./parsers/SyslogParser');
const ApacheParser = require('./parsers/ApacheParser');
const GenericParser = require('./parsers/GenericParser');

class ParserFactory {
  constructor() {
    this.parsers = {
      spaceDelimited: new SpaceDelimitedParser(),
      json: new JsonLogParser(),
      syslog: new SyslogParser(),
      apache: new ApacheParser(),
      generic: new GenericParser()
    };
  }

  getParser(format) {
    return this.parsers[format] || this.parsers.generic;
  }
}

module.exports = ParserFactory;
