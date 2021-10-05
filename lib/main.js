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
        this._open_cmu_db();
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
        var prefix, schema, sql;
        ({prefix, schema} = this.cfg);
        sql = {
          get_db_object_count: SQL`select count(*) as count from ${schema}.sqlite_schema;`,
          truncate_entries: SQL`delete from ${schema}.entries;`,
          insert_entry: SQL`insert into ${schema}.entries ( word, arpabet_s )
  values ( $word, $arpabet_s );`
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

      _truncate_entries() {
        return this.db(this.sql.truncate_entries);
      }

      //---------------------------------------------------------------------------------------------------------
      _open_cmu_db() {
        this.db.open(this.cfg);
        if (this.cfg.create || (this._get_db_object_count() === 0)) {
          this._create_db_structure();
          this._populate_db();
        } else {
          null;
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_db() {
        var insert, line_nr;
        line_nr = 0;
        this._truncate_entries();
        insert = this.db.prepare(this.sql.insert_entry);
        this.db(() => {
          var arpabet_s, line, ref, word;
          ref = guy.fs.walk_lines(this.cfg.source_path);
          for (line of ref) {
            if (line.startsWith(';;;')) {
              continue;
            }
            line_nr++;
            // break if line_nr > 10
            line = line.trimEnd();
            [word, arpabet_s] = line.split('\x20\x20');
            if ((word.endsWith("'S")) || (word.endsWith("'"))) {
              continue;
            }
            if ((word.match(/'S\(\d\)$/)) != null) {
              continue;
            }
            if (!((word != null) && word.length > 0 && (arpabet_s != null) && arpabet_s.length > 0)) {
              warn('^4443^', line_nr, rpr(line));
            }
            insert.run({word, arpabet_s});
          }
          return null;
        });
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
          source_path: PATH.resolve(PATH.join(__dirname, '../cmudict-0.7b')),
          create: false
        }
      }
    });

    return Cmud;

  }).call(this);

}).call(this);

//# sourceMappingURL=main.js.map