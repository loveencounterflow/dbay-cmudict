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
    arpabet_s text    not null,
    ipa       text    not null );
create index if not exists ${schema}.entries_word_idx
  on entries ( word );
create table if not exists ${schema}.abipa (
  cv          text    not null,
  ab1         text,
  ab2         text    not null primary key,
  ipa         text    not null,
  example     text    not null );`);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_sql() {
        var prefix, schema, sql;
        ({prefix, schema} = this.cfg);
        sql = {
          get_db_object_count: SQL`select count(*) as count from ${schema}.sqlite_schema;`,
          truncate_entries: SQL`delete from ${schema}.entries;`,
          truncate_abipa: SQL`delete from ${schema}.abipa;`,
          insert_entry: SQL`insert into ${schema}.entries ( word, arpabet_s, ipa )
  values ( $word, $arpabet_s, $ipa );`,
          insert_abipa: SQL`insert into ${schema}.abipa ( cv, ab1, ab2, ipa, example )
  values ( $cv, $ab1, $ab2, $ipa, $example );`
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

      _truncate_abipa() {
        return this.db(this.sql.truncate_abipa);
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
        this._populate_arpabet_to_ipa();
        return this._populate_entries();
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_entries() {
        var count, insert;
        count = 0;
        this._truncate_entries();
        insert = this.db.prepare(this.sql.insert_entry);
        this.db(() => {
          var arpabet_s, ipa, line, ref, word;
          ref = guy.fs.walk_lines(this.cfg.source_path);
          for (line of ref) {
            if (line.startsWith(';;;')) {
              continue;
            }
            line = line.trimEnd();
            [word, arpabet_s] = line.split('\x20\x20');
            if ((word.endsWith("'S")) || (word.endsWith("'"))) {
              continue;
            }
            if ((word.match(/'S\(\d\)$/)) != null) {
              continue;
            }
            if (!((word != null) && word.length > 0 && (arpabet_s != null) && arpabet_s.length > 0)) {
              warn('^4443^', count, rpr(line));
              continue;
            }
            count++;
            ipa = this.ipa_from_arpabet_s(arpabet_s);
            insert.run({word, arpabet_s, ipa});
          }
          return null;
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_arpabet_to_ipa() {
        var insert, ipa_by_ab2, line_nr;
        this._truncate_abipa();
        line_nr = 0;
        ipa_by_ab2 = {};
        insert = this.db.prepare(this.sql.insert_abipa);
        this.db(() => {
          var ab1, ab2, cv, example, field, fields, i, idx, ipa, j, len, len1, line, ref;
          ref = guy.fs.walk_lines(this.cfg.arpaipa_path);
          for (line of ref) {
            line_nr++;
            if (line.startsWith('#')) {
              continue;
            }
            fields = line.split('\t');
            for (idx = i = 0, len = fields.length; i < len; idx = ++i) {
              field = fields[idx];
              fields[idx] = field.trim();
            }
            for (idx = j = 0, len1 = fields.length; j < len1; idx = ++j) {
              field = fields[idx];
              if (field === 'N/A') {
                fields[idx] = null;
              }
            }
            [cv, ab1, ab2, ipa, example] = fields;
            example = example.replace(/\x20/g, '');
            ipa_by_ab2[ab2] = ipa;
            insert.run({cv, ab1, ab2, ipa, example});
          }
          return null;
        });
        ipa_by_ab2 = guy.lft.freeze(ipa_by_ab2);
        guy.props.def(this, 'ipa_by_ab2', {
          enumerable: false,
          value: ipa_by_ab2
        });
        return null;
      }

      //=========================================================================================================

      //---------------------------------------------------------------------------------------------------------
      // ipa_from_arpabet_s_1: ( arpabet_s ) ->
      //   R = arpabet_s.replace /\b[\S]+?\b/g, ( match ) =>
      //     match = match.replace /\d+$/, ''
      //     return @ipa_by_ab2[ match ] ? '?'
      //   return R.replace /\s/g, ''

        //---------------------------------------------------------------------------------------------------------
      ipa_from_arpabet_s(arpabet_s) {
        var R, idx, phone;
        R = arpabet_s.split('\x20');
        return ((function() {
          var i, len, ref, results;
          results = [];
          for (idx = i = 0, len = R.length; i < len; idx = ++i) {
            phone = R[idx];
            results.push((ref = this.ipa_by_ab2[phone.replace(/\d+$/, '')]) != null ? ref : '?');
          }
          return results;
        }).call(this)).join('');
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
          arpaipa_path: PATH.resolve(PATH.join(__dirname, '../arpabet-to-ipa.tsv')),
          create: false
        }
      }
    });

    return Cmud;

  }).call(this);

}).call(this);

//# sourceMappingURL=main.js.map