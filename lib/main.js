(function() {
  'use strict';
  var CND, PATH, SQL, badge, debug, echo, guy, help, info, isa, rpr, type_of, types, urge, validate, validate_list_of, warn, whisper;

  //###########################################################################################################
  CND = require('cnd');

  rpr = CND.rpr;

  badge = 'DBAY-CMUDICT';

  debug = CND.get_logger('debug', badge);

  warn = CND.get_logger('warn', badge);

  info = CND.get_logger('info', badge);

  urge = CND.get_logger('urge', badge);

  help = CND.get_logger('help', badge);

  whisper = CND.get_logger('whisper', badge);

  echo = CND.echo.bind(CND);

  //...........................................................................................................
  PATH = require('path');

  types = require('./types');

  ({isa, type_of, validate, validate_list_of} = types.export());

  SQL = String.raw;

  guy = require('guy');

  //===========================================================================================================
  this.Cmud = (function() {
    class Cmud {
      //---------------------------------------------------------------------------------------------------------
      static cast_constructor_cfg(me, cfg = null) {
        var R, clasz;
        clasz = me.constructor;
        R = cfg != null ? cfg : me.cfg;
        // #.......................................................................................................
        // if R.path?
        //   R.temporary  ?= false
        //   R.path        = PATH.resolve R.path
        // else
        //   R.temporary  ?= true
        //   filename        = me._get_random_filename()
        //   R.path        = PATH.resolve PATH.join clasz.C.autolocation, filename
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      static declare_types(me) {
        var db;
        /* called from constructor via `guy.cfg.configure_with_types()` */
        me.cfg = this.cast_constructor_cfg(me);
        me.types.validate.constructor_cfg(me.cfg);
        ({db} = guy.obj.pluck_with_fallback(me.cfg, null, 'db'));
        guy.props.def(me, 'db', {
          enumerable: false,
          value: db
        });
        me.cfg = guy.lft.freeze(guy.obj.omit_nullish(me.cfg));
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      constructor(cfg) {
        guy.cfg.configure_with_types(this, cfg, types);
        this._compile_sql();
        this._create_sql_functions();
        this.open_cmu_db();
        return void 0;
      }

      //---------------------------------------------------------------------------------------------------------
      _create_db_structure() {
        var prefix, schema;
        ({prefix, schema} = this.cfg);
        this.db.execute(SQL`create table if not exists ${schema}.entries (
    id        integer not null primary key,
    word      text    not null,
    arpabet_s text    not null );`);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_sql() {
        var prefix, schema, schema_i, sql;
        ({prefix, schema} = this.cfg);
        schema_i = this.db.sql.I(schema);
        sql = {
          get_db_object_count: SQL`select count(*) as count from ${schema_i}.sqlite_schema;`
        };
        guy.props.def(this, 'sql', {
          enumerable: false,
          value: sql
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _create_sql_functions() {
        var prefix, schema;
        ({prefix, schema} = this.cfg);
        // #.......................................................................................................
        // @dba.create_function
        //   name:           "#{prefix}_tags_from_id",
        //   deterministic:  true,
        //   varargs:        false,
        //   call:           ( id ) =>
        //     fallbacks = @get_filtered_fallbacks()
        //     tagchain  = @tagchain_from_id { id, }
        //     tags      = @tags_from_tagchain { tagchain, }
        //     return JSON.stringify { fallbacks..., tags..., }
        //.......................................................................................................
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_db_object_count() {
        return this.db.single_value(this.sql.get_db_object_count);
      }

      //---------------------------------------------------------------------------------------------------------
      open_cmu_db() {
        var create, path, prefix, schema;
        ({prefix, schema, path, create} = this.cfg);
        this.db.open({path, schema});
        debug('^938^', this._get_db_object_count());
        if (create || (this._get_db_object_count() === 0)) {
          this._create_db_structure();
          this._populate_db();
        } else {
          null;
        }
        return null;
      }

    };

    //---------------------------------------------------------------------------------------------------------
    Cmud.C = guy.lft.freeze({
      defaults: {
        //.....................................................................................................
        constructor_cfg: {
          db: null,
          prefix: 'cmud_',
          schema: 'cmud',
          path: PATH.resolve(PATH.join(__dirname, '../cmudict.sqlite')),
          create: false
        }
      }
    });

    return Cmud;

  }).call(this);

}).call(this);

//# sourceMappingURL=main.js.map