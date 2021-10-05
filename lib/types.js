(function() {
  'use strict';
  var CND, Intertype, alert, badge, dbay_types, debug, help, info, intertype, jr, rpr, urge, warn, whisper;

  //###########################################################################################################
  CND = require('cnd');

  rpr = CND.rpr;

  badge = 'DBAY-CMUDICT/TYPES';

  debug = CND.get_logger('debug', badge);

  alert = CND.get_logger('alert', badge);

  whisper = CND.get_logger('whisper', badge);

  warn = CND.get_logger('warn', badge);

  help = CND.get_logger('help', badge);

  urge = CND.get_logger('urge', badge);

  info = CND.get_logger('info', badge);

  jr = JSON.stringify;

  Intertype = (require('intertype')).Intertype;

  intertype = new Intertype(module.exports);

  dbay_types = require('dbay/lib/types');

  //-----------------------------------------------------------------------------------------------------------
  this.declare('constructor_cfg', {
    tests: {
      "@isa.object x": function(x) {
        return this.isa.object(x);
      },
      "@isa.nonempty_text x.prefix": function(x) {
        return this.isa.nonempty_text(x.prefix);
      },
      "@isa.nonempty_text x.path": function(x) {
        return this.isa.nonempty_text(x.path);
      },
      "dbay_types.dbay_schema x.schema": function(x) {
        return dbay_types.isa.dbay_schema(x.schema);
      },
      "@isa.boolean x.create": function(x) {
        return this.isa.boolean(x.create);
      }
    }
  });

}).call(this);

//# sourceMappingURL=types.js.map