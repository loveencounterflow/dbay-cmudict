(function() {
  'use strict';
  var BRITFONE, CND, PATH, SQL, badge, data_path, debug, echo, guy, help, home, info, isa, rpr, type_of, types, urge, validate, validate_list_of, warn, whisper;

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

  home = PATH.resolve(PATH.join(__dirname, '..'));

  data_path = PATH.join(home, 'data');

  BRITFONE = require('britfone');

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
        me.cfg = guy.lft.freeze(guy.obj.omit_nullish(me.cfg));
        guy.props.def(me, 'db', {
          enumerable: false,
          value: db
        });
        guy.props.def(me, 'cache', {
          enumerable: false,
          value: {}
        });
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
        this.db.execute(SQL`drop index if exists ${schema}.entries_word_idx;
drop index if exists ${schema}.entries_ipa_idx;
drop table if exists ${schema}.trlits;
drop table if exists ${schema}.trlit_nicks;
drop table if exists ${schema}.abs_phones;
drop table if exists ${schema}.entries;
drop table if exists ${schema}.source_nicks;
-- ...................................................................................................
vacuum ${schema};
-- ...................................................................................................
create table ${schema}.entries (
    id        integer not null primary key,
    word      text    not null,
    source    text    not null references source_nicks ( nick ),
    nr        integer not null default 1,
    ipa       text    not null,
    ipa_raw   text    not null );
create index ${schema}.entries_word_idx on entries ( word );
create index ${schema}.entries_ipa_idx  on entries ( ipa );
-- ...................................................................................................
create table ${schema}.trlits ( -- trlits: transliterations
    ipa         text    not null,
    nick        text    not null references trlit_nicks ( nick ),
    trlit       text    not null,
    example     text,
  primary key ( ipa, nick ) );
create table ${schema}.trlit_nicks (
    nick        text    not null,
    name        text    not null,
    comment     text,
  primary key ( nick ) );
create table ${schema}.source_nicks (
    nick        text    not null,
    name        text    not null,
    comment     text,
  primary key ( nick ) );`);
        // -- -- ...................................................................................................
        // -- create view #{schema}.abs_phones as select
        // --     r1.word   as word,
        // --     r2.lnr    as lnr,
        // --     r2.rnr    as rnr,
        // --     r2.part   as abs1_phone
        // --   from
        // --     entries                           as r1,
        // --     std_str_split_re( r1.abs1, '\s' ) as r2;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_sql() {
        var prefix, schema, sql;
        ({prefix, schema} = this.cfg);
        sql = {
          get_db_object_count: SQL`select count(*) as count from ${schema}.sqlite_schema;`,
          truncate_entries: SQL`delete from ${schema}.entries where source = $source;`,
          insert_entry: SQL`insert into ${schema}.entries ( word, source, nr, ipa_raw, ipa )
  values ( $word, $source, $nr, $ipa_raw, $ipa );`,
          insert_trlit: SQL`insert into ${schema}.trlits ( ipa, nick, trlit, example )
  values ( $ipa, $nick, $trlit, $example );`,
          upsert_source_nick: SQL`insert into ${schema}.source_nicks ( nick, name, comment )
  values ( $nick, $name, $comment )
  on conflict ( nick ) do update set
    name = excluded.name, comment = excluded.comment;`,
          upsert_trlit_nick: SQL`insert into ${schema}.trlit_nicks ( nick, name, comment )
  values ( $nick, $name, $comment )
  on conflict ( nick ) do update set
    name = excluded.name, comment = excluded.comment;`,
          delete_arpabet_trlits: SQL`delete from ${schema}.trlits
  where nick in ( 'ab1', 'ab2' );`
        };
        // insert_abs_phones: SQL"""
        //   insert into #{schema}.abs_phones ( word, lnr, rnr, abs0_phone, abs1_phone, stress )
        //     values ( $word, $lnr, $rnr, $abs0_phone, $abs1_phone, $stress );"""
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
        // #-------------------------------------------------------------------------------------------------------
        // @db.create_function
        //   name:           prefix + 'ipa_from_abs1'
        //   deterministic:  true
        //   varargs:        false
        //   call:           ( abs1 ) => @ipa_from_abs1( abs1 )
        //.......................................................................................................
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_db_object_count() {
        return this.db.single_value(this.sql.get_db_object_count);
      }

      _truncate_entries(source) {
        return this.db(this.sql.truncate_entries, {source});
      }

      _delete_arpabet_trlits() {
        return this.db(this.sql.delete_arpabet_trlits);
      }

      //---------------------------------------------------------------------------------------------------------
      _open_cmu_db() {
        this.db.open(this.cfg);
        if (this.cfg.rebuild || (this._get_db_object_count() === 0)) {
          this._create_db_structure();
          this._populate_db();
        } else {
          null;
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_db() {
        this._populate_arpabet_trlits();
        // @_populate_xsampa_to_ipa()
        this._cache_spellings();
        this._populate_cmu_entries();
        this._populate_beep_entries();
        return this._populate_bf_entries();
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_cmu_entries() {
        var count, insert_entry, source;
        count = 0;
        insert_entry = this.db.prepare(this.sql.insert_entry);
        source = 'cmu';
        this._truncate_entries(source);
        this.db(this.sql.upsert_source_nick, {
          nick: source,
          name: "CMUdict",
          comment: "v0.7b"
        });
        this.db(() => {
          var ab, ipa, ipa_raw, line, nr, ref, ref1, word;
          ref = guy.fs.walk_lines(this.cfg.paths.cmu);
          for (line of ref) {
            if (line.startsWith(';;;')) {
              continue;
            }
            line = line.trimEnd();
            [word, ab] = line.split('\x20\x20');
            word = word.trim();
            if ((word == null) || (word.length === 0) || (ab == null) || (ab.length === 0)) {
              warn('^4443^', count, rpr(line));
              continue;
            }
            //...................................................................................................
            count++;
            if (count > this.cfg.max_entry_count) {
              warn('^dbay-cmudict/main@1^', `shortcutting at ${this.cfg.max_entry_count} entries`);
              break;
            }
            ({word, nr} = this._get_bracketed_nr(word));
            word = word.toLowerCase();
            word = (ref1 = this.cache.spellings[word]) != null ? ref1 : word/* replace LC variant with correct upper/lower case where found */
            ipa_raw = this.ipa_raw_from_arpabet2(ab);
            ipa = this.ipa_from_cmu_ipa_raw(ipa_raw);
            insert_entry.run({word, source, nr, ipa_raw, ipa});
          }
          return null;
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_beep_entries() {
        var count, insert_entry, nr, source;
        count = 0;
        insert_entry = this.db.prepare(this.sql.insert_entry);
        source = 'be';
        nr = 1;
        this._truncate_entries(source);
        this.db(this.sql.upsert_source_nick, {
          nick: source,
          name: "BEEP",
          comment: "v1.0"
        });
        this.db(() => {
          var ab, ipa, ipa_raw, line, match, ref, ref1, word;
          ref = guy.fs.walk_lines(this.cfg.paths.beep);
          for (line of ref) {
            if (line.startsWith('#')) {
              continue;
            }
            line = line.trim();
            if (line.length === 0) {
              continue;
            }
            if ((match = line.match(/(?<word>\S+)\s+(?<ab>.*)$/)) == null) {
              continue;
            }
            ({word, ab} = match.groups);
            if ((word.length === 0) || (ab.length === 0)) {
              warn('^4443^', count, rpr(line));
              continue;
            }
            //...................................................................................................
            count++;
            if (count > this.cfg.max_entry_count) {
              warn('^dbay-cmudict/main@2^', `shortcutting at ${this.cfg.max_entry_count} entries`);
              break;
            }
            word = word.toLowerCase();
            word = (ref1 = this.cache.spellings[word]) != null ? ref1 : word/* replace LC variant with correct upper/lower case where found */
            word = this._rewrite_beep_word(word);
            ipa_raw = this.ipa_raw_from_arpabet2(ab);
            ipa = this.ipa_from_beep_ipa_raw(ipa_raw);
            insert_entry.run({word, source, nr, ipa_raw, ipa});
          }
          return null;
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_bf_entries() {
        var count, insert_entry, source;
        count = 0;
        insert_entry = this.db.prepare(this.sql.insert_entry);
        source = 'bf';
        this._truncate_entries(source);
        this.db(this.sql.upsert_source_nick, {
          nick: source,
          name: "Britfone",
          comment: "v3.0.1"
        });
        this.db(() => {
          var ipa, ipa_raw, line, match, nr, ref, ref1, word;
          ref = guy.fs.walk_lines(this.cfg.paths.bf_main);
          for (line of ref) {
            if (line.startsWith('#')) {
              continue;
            }
            line = line.trim();
            if (line.length === 0) {
              continue;
            }
            if ((match = line.match(/(?<word>[^,]+),\s*(?<ipa_raw>.*)$/)) == null) {
              continue;
            }
            ({word, ipa_raw} = match.groups);
            if ((word.length === 0) || (ipa_raw.length === 0)) {
              warn('^4443^', count, rpr(line));
              continue;
            }
            //...................................................................................................
            count++;
            if (count > this.cfg.max_entry_count) {
              warn('^dbay-cmudict/main@2^', `shortcutting at ${this.cfg.max_entry_count} entries`);
              break;
            }
            ({word, nr} = this._get_bracketed_nr(word));
            word = word.toLowerCase();
            word = (ref1 = this.cache.spellings[word]) != null ? ref1 : word/* replace LC variant with correct upper/lower case where found */
            // word      = word.replace /_/g, '\x20'
            ipa = this.ipa_from_britfone_ipa_raw(ipa_raw);
            insert_entry.run({word, source, nr, ipa_raw, ipa});
          }
          return null;
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _cache_spellings() {
        var base1, cache, count, lc, line, match, ref, spelling;
        cache = ((base1 = this.cache).spellings != null ? base1.spellings : base1.spellings = {});
        count = 0;
        ref = guy.fs.walk_lines(this.cfg.paths.spellings);
        for (line of ref) {
          if (line.startsWith('#')) {
            continue;
          }
          line = line.trim();
          if (line.length === 0) {
            continue;
          }
          if ((match = line.match(/(?<lc>\S+)\s+(?<spelling>.*)$/)) == null) {
            continue;
          }
          //.....................................................................................................
          count++;
          if (count > this.cfg.max_entry_count) {
            warn('^dbay-cmudict/main@3^', `shortcutting at ${this.cfg.max_entry_count} entries`);
            break;
          }
          //.....................................................................................................
          ({lc, spelling} = match.groups);
          lc = lc.toLowerCase();
          spelling = spelling.trimEnd();
          cache[lc] = spelling;
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_arpabet_trlits() {
        var insert_trlit, line_nr;
        this._delete_arpabet_trlits();
        line_nr = 0;
        insert_trlit = this.db.prepare(this.sql.insert_trlit);
        this.db(this.sql.upsert_trlit_nick, {
          nick: 'ab1',
          name: "ARPAbet1",
          comment: null
        });
        this.db(this.sql.upsert_trlit_nick, {
          nick: 'ab2',
          name: "ARPAbet2",
          comment: null
        });
        this.db(() => {
          var ab1, ab2, cv, example, field, fields, i, idx, ipa, j, len, len1, line, ref;
          ref = guy.fs.walk_lines(this.cfg.paths.abipa);
          for (line of ref) {
            line_nr++;
            line = line.trim();
            if (line.length === 0) {
              continue;
            }
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
            if (ab1) {
              ab1 = ab1.toLowerCase();
            }
            ab2 = ab2.toLowerCase();
            example = example.replace(/\x20/g, '');
            if (ab1 != null) {
              insert_trlit.run({
                ipa,
                nick: 'ab1',
                trlit: ab1,
                example
              });
            }
            insert_trlit.run({
              ipa,
              nick: 'ab2',
              trlit: ab2,
              example
            });
          }
          return null;
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _undoublequote(text) {
        var last_idx;
        if (text[0] !== '"') {
          return text;
        }
        if (text[last_idx = text.length - 1] !== '"') {
          return text;
        }
        return text.slice(1, last_idx);
      }

      //---------------------------------------------------------------------------------------------------------
      _populate_xsampa_to_ipa() {
        var insert/* #cache */, line_nr, xs_by_ipa;
        this._truncate_xsipa();
        line_nr = 0;
        xs_by_ipa = {};
        insert = this.db.prepare(this.sql.insert_xsipa);
        this.db(() => {
          var _, description, example, field, fields, i, idx, ipa, len, line, ref, xs;
          ref = guy.fs.walk_lines(this.cfg.paths.xsipa);
          for (line of ref) {
            line_nr++;
            line = line.trim();
            if (line.length === 0) {
              continue;
            }
            if (line.startsWith('#')) {
              continue;
            }
            fields = line.split('\t');
            for (idx = i = 0, len = fields.length; i < len; idx = ++i) {
              field = fields[idx];
              fields[idx] = field.trim();
            }
            // fields[ idx ]     = null for field, idx in fields when field is 'N/A'
            [xs, ipa, _, description, example] = fields;
            if (example == null) {
              example = "(no example)";
            }
            example = this._undoublequote(example);
            example = example.replace(/\\"/g, '"');
            xs_by_ipa[ipa] = xs/* #cache */
            insert.run({description, xs, ipa, example});
          }
          return null;
        });
        xs_by_ipa = guy.lft.freeze(xs_by_ipa);
        /* #cache */        guy.props.def(this, 'xs_by_ipa', {
          enumerable: false,
          value: xs_by_ipa
        });
/* #cache */        return null;
      }

      //=========================================================================================================

      //---------------------------------------------------------------------------------------------------------
      _build_cache_ipa_raw_from_arpabet2() {
        var R, ref, row;
        R = {};
        ref = this.db(SQL`select * from ${this.cfg.schema}.trlits where nick = 'ab2';`);
        for (row of ref) {
          R[row.trlit] = row.ipa;
        }
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      ipa_raw_from_arpabet2(ab) {
        var R, base, base1, cache, i, j, len, len1, letter, level, match, phone, ref, ref1, ref2, ref3, replacement, stress;
        cache = ((base1 = this.cache).ipa_raw_from_arpabet2 != null ? base1.ipa_raw_from_arpabet2 : base1.ipa_raw_from_arpabet2 = this._build_cache_ipa_raw_from_arpabet2());
        replacement = this.constructor.C.replacement;
        R = [];
        ab = ab.trim().toLowerCase();
        ref = ab.split(/\x20+/);
        for (i = 0, len = ref.length; i < len; i++) {
          phone = ref[i];
          stress = null;
          if ((match = phone.match(/^(?<base>\D+)(?<level>\d*)$/)) != null) {
            ({base, level} = match.groups);
            ref2 = Array.from((ref1 = cache[base]) != null ? ref1 : replacement);
            for (j = 0, len1 = ref2.length; j < len1; j++) {
              letter = ref2[j];
              R.push(letter + level);
            }
          } else {
            R.push((ref3 = cache[phone]) != null ? ref3 : replacement);
          }
        }
        return R.join(' ');
      }

      //---------------------------------------------------------------------------------------------------------
      ipa_from_cmu_ipa_raw(ipa_raw) {
        var R;
        R = ipa_raw;
        R = ',' + (R.replace(/\x20+/g, ',')) + ',';
        R = R.replace(/,ʌ([02]),/g, ',ə$1,');
        R = R.replace(/,ɝ0,/g, ',ə0,r,');
        R = R.replace(/,ɝ1,/g, ',ɜ1,r,');
        R = R.replace(/,ɝ2,/g, ',ɜ2,r,');
        R = R.replace(/,/g, '');
        R = R.replace(/0/g, '');
        R = R.replace(/1/g, '̲');
        R = R.replace(/2/g, '̤');
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      ipa_from_beep_ipa_raw(ipa_raw) {
        var R;
        R = ipa_raw;
        R = ',' + (R.replace(/\x20+/g, ',')) + ',';
        R = R.replace(/,ɝ,/g, ',ɜ,r,');
        R = R.replace(/,/g, '');
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      ipa_from_britfone_ipa_raw(ipa_raw) {
        var R;
        R = ipa_raw;
        R = R.replace(/\x20+/g, '');
        // R = ',' + ( R.replace /\x20+/g, ',' ) + ','
        // # R = R.replace /,ɝ,/g,           ',ɜ,r,'
        // R = R.replace /,/g,             ''
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_bracketed_nr(word) {
        var nr;
        nr = 1;
        word = word.replace(/\((\d+)\)$/, ($0, $1, index) => {
          nr = parseInt($1, 10);
          return '';
        });
        return {word, nr};
      }

      //---------------------------------------------------------------------------------------------------------
      _rewrite_beep_word(word) {
        var R;
        R = word;
        R = R.replace(/_/g, '\x20');
        R = R.replace(/\\'a/g, 'á');
        R = R.replace(/\\`a/g, 'à');
        R = R.replace(/\\\^a/g, 'â');
        R = R.replace(/\\'e/g, 'é');
        R = R.replace(/\\`e/g, 'è');
        R = R.replace(/\\\^e/g, 'ê');
        R = R.replace(/\\\^o/g, 'ô');
        return R;
      }

    };

    //---------------------------------------------------------------------------------------------------------
    Cmud.C = guy.lft.freeze({
      replacement: '█',
      defaults: {
        //.....................................................................................................
        constructor_cfg: {
          db: null,
          prefix: 'cmud_',
          schema: 'cmud',
          path: PATH.join(home, 'cmudict.sqlite'),
          paths: {
            cmu: PATH.join(data_path, 'cmudict-0.7b'),
            beep: PATH.join(data_path, 'beep/beep-1.0'),
            bf_expansions: BRITFONE.expansions,
            bf_main: BRITFONE.main,
            bf_symbols: BRITFONE.symbols,
            spellings: PATH.join(data_path, 'beep/case.txt'),
            abipa: PATH.join(data_path, 'arpabet-to-ipa.tsv'),
            xsipa: PATH.join(data_path, 'xsampa-to-ipa.tsv')
          },
          rebuild: false,
          max_entry_count: 2e308
        }
      }
    });

    return Cmud;

  }).call(this);

}).call(this);

//# sourceMappingURL=main.js.map