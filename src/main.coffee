
'use strict'


############################################################################################################
CND                       = require 'cnd'
rpr                       = CND.rpr
badge                     = 'DBAY-CMUDICT'
debug                     = CND.get_logger 'debug',     badge
warn                      = CND.get_logger 'warn',      badge
info                      = CND.get_logger 'info',      badge
urge                      = CND.get_logger 'urge',      badge
help                      = CND.get_logger 'help',      badge
whisper                   = CND.get_logger 'whisper',   badge
echo                      = CND.echo.bind CND
#...........................................................................................................
PATH                      = require 'path'
types                     = require './types'
{ isa
  type_of
  validate
  validate_list_of }      = types.export()
SQL                       = String.raw
guy                       = require 'guy'


#===========================================================================================================
class @Cmud

  #---------------------------------------------------------------------------------------------------------
  @C: guy.lft.freeze
    replacement:  '█'
    defaults:
      #.....................................................................................................
      constructor_cfg:
        db:               null
        prefix:           'cmud_'
        schema:           'cmud'
        path:             PATH.resolve PATH.join __dirname, '../cmudict.sqlite'
        source_path:      PATH.resolve PATH.join __dirname, '../cmudict-0.7b'
        abipa_path:       PATH.resolve PATH.join __dirname, '../arpabet-to-ipa.tsv'
        xsipa_path:       PATH.resolve PATH.join __dirname, '../xsampa-to-ipa.tsv'
        create:           false
        max_entry_count:  Infinity

  #---------------------------------------------------------------------------------------------------------
  @cast_constructor_cfg: ( me, cfg = null ) ->
    clasz           = me.constructor
    R               = cfg ? me.cfg
    # #.......................................................................................................
    # if R.path?
    #   R.temporary  ?= false
    #   R.path        = PATH.resolve R.path
    # else
    #   R.temporary  ?= true
    #   filename        = me._get_random_filename()
    #   R.path        = PATH.resolve PATH.join clasz.C.autolocation, filename
    return R

  #---------------------------------------------------------------------------------------------------------
  @declare_types: ( me ) ->
    ### called from constructor via `guy.cfg.configure_with_types()` ###
    me.cfg        = @cast_constructor_cfg me
    me.types.validate.constructor_cfg me.cfg
    { db, }       = guy.obj.pluck_with_fallback me.cfg, null, 'db'
    me.cfg        = guy.lft.freeze guy.obj.omit_nullish me.cfg
    guy.props.def me, 'db',     { enumerable: false, value: db, }
    guy.props.def me, 'cache',  { enumerable: false, value: {}, }
    return null

  #---------------------------------------------------------------------------------------------------------
  constructor: ( cfg ) ->
    guy.cfg.configure_with_types @, cfg, types
    @_compile_sql()
    @_create_sql_functions()
    @_open_cmu_db()
    return undefined

  #---------------------------------------------------------------------------------------------------------
  _create_db_structure: ->
    { prefix
      schema } = @cfg
    @db.execute SQL"""
      drop index if exists #{schema}.entries_word_idx;
      drop table if exists #{schema}.trlits;
      drop table if exists #{schema}.trlit_nicks;
      drop table if exists #{schema}.abs_phones;
      drop table if exists #{schema}.entries;
      -- ...................................................................................................
      vacuum #{schema};
      -- ...................................................................................................
      create table #{schema}.entries (
          id        integer not null primary key,
          word      text    not null,
          ipa_raw   text    not null );
      create index #{schema}.entries_word_idx
        on entries ( word );
      -- create index #{schema}.entries_ipa_idx
      --   on entries ( ipa );
      -- -- ...................................................................................................
      -- create table #{schema}.abs_phones (
      --     word        text    not null,
      --     lnr         integer not null,
      --     rnr         integer not null,
      --     abs0_phone  text    not null,
      --     abs1_phone  text    not null,
      --     stress      integer,
      --   primary key ( word, lnr ) );
      -- ...................................................................................................
      -- **Note** Table trlits collects all transliterations into a single table. This has been done for
      -- extensibility so you don't have to modify the DB's structure just to add a transliteration scheme.
      create table #{schema}.trlits ( -- trlits: transliterations
          ipa         text    not null,
          nick        text    not null, -- code for transliterations
          trlit       text    not null,
          example     text,
        primary key ( ipa, nick ) );
      create table #{schema}.trlit_nicks (
          nick        text    not null,
          name        text    not null,
          comment     text,
        primary key ( nick ) );
      -- -- ...................................................................................................
      -- create view #{schema}.abs_phones as select
      --     r1.word   as word,
      --     r2.lnr    as lnr,
      --     r2.rnr    as rnr,
      --     r2.part   as abs1_phone
      --   from
      --     entries                           as r1,
      --     std_str_split_re( r1.abs1, '\s' ) as r2;
      """
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_sql: ->
    { prefix
      schema }  = @cfg
    sql         =
      get_db_object_count:  SQL"select count(*) as count from #{schema}.sqlite_schema;"
      truncate_entries:     SQL"delete from #{schema}.entries;"
      insert_entry: SQL"""
        insert into #{schema}.entries ( word, ipa_raw )
          values ( $word, $ipa_raw );"""
      insert_trlit: SQL"""
        insert into #{schema}.trlits ( ipa, nick, trlit, example )
          values ( $ipa, $nick, $trlit, $example );"""
      delete_arpabet_trlits: SQL"""
        delete from #{schema}.trlits
          where nick in ( 'ab1', 'ab2' );
        """
      # insert_abs_phones: SQL"""
      #   insert into #{schema}.abs_phones ( word, lnr, rnr, abs0_phone, abs1_phone, stress )
      #     values ( $word, $lnr, $rnr, $abs0_phone, $abs1_phone, $stress );"""
    guy.props.def @, 'sql', { enumerable: false, value: sql, }
    return null

  #---------------------------------------------------------------------------------------------------------
  _create_sql_functions: ->
    { prefix
      schema } = @cfg
    # #-------------------------------------------------------------------------------------------------------
    # @db.create_function
    #   name:           prefix + 'ipa_from_abs1'
    #   deterministic:  true
    #   varargs:        false
    #   call:           ( abs1 ) => @ipa_from_abs1( abs1 )
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _get_db_object_count:   -> @db.single_value @sql.get_db_object_count
  _truncate_entries:      -> @db @sql.truncate_entries
  _delete_arpabet_trlits: -> @db @sql.delete_arpabet_trlits

  #---------------------------------------------------------------------------------------------------------
  _open_cmu_db: ->
    @db.open @cfg
    if @cfg.create or ( @_get_db_object_count() is 0 )
      @_create_db_structure()
      @_populate_db()
    else
      null
    return null

  #---------------------------------------------------------------------------------------------------------
  _populate_db: ->
    @_populate_arpabet_trlits()
    # @_populate_xsampa_to_ipa()
    @_populate_entries()

  #---------------------------------------------------------------------------------------------------------
  _populate_entries: ->
    count = 0
    @_truncate_entries()
    insert_entry = @db.prepare @sql.insert_entry
    @db =>
      for line from guy.fs.walk_lines @cfg.source_path
        continue if line.startsWith ';;;'
        line                  = line.trimEnd()
        [ word, ab, ]         = line.split '\x20\x20'
        word                  = word.trim()
        continue if ( word.endsWith "'S" ) or ( word.endsWith "'" )
        continue if ( word.match /'S\(\d\)$/ )?
        if ( not word? ) or ( word.length is 0 ) or ( not ab? ) or ( ab.length is 0 )
          warn '^4443^', count, ( rpr line )
          continue
        #...................................................................................................
        count++
        if count > @cfg.max_entry_count
          warn '^dbay-cmudict/main@1^', "shortcutting at #{@cfg.max_entry_count} entries"
          break
        word      = word.toLowerCase()
        ab        = ab.trim().toLowerCase()
        ipa_raw   = @ipa_raw_from_arpabet2 ab
        # abs1      = @_rewrite_arpabet_s ab.toLowerCase()
        # ipa       = @ipa_from_abs1 abs1
        # xsampa    = @xsampa_from_ipa  ipa
        # debug '^4345^', { word, ipa_raw, }
        insert_entry.run { word, ipa_raw, }
      return null
    return null

  #---------------------------------------------------------------------------------------------------------
  _populate_arpabet_trlits: ->
    @_delete_arpabet_trlits()
    line_nr       = 0
    insert_trlit  = @db.prepare @sql.insert_trlit
    ### TAINT insert into trlit registry ###
    @db =>
      for line from guy.fs.walk_lines @cfg.abipa_path
        line_nr++
        line              = line.trim()
        continue if line.length is 0
        continue if line.startsWith '#'
        fields            = line.split '\t'
        fields[ idx ]     = field.trim() for field, idx in fields
        fields[ idx ]     = null for field, idx in fields when field is 'N/A'
        [ cv
          ab1
          ab2
          ipa
          example ]       = fields
        ab1               = ab1.toLowerCase() if ab1
        ab2               = ab2.toLowerCase()
        example           = example.replace /\x20/g, ''
        insert_trlit.run { ipa, nick: 'ab1', trlit: ab1, example, } if ab1?
        insert_trlit.run { ipa, nick: 'ab2', trlit: ab2, example, }
      return null
    return null

  #---------------------------------------------------------------------------------------------------------
  _undoublequote: ( text ) ->
    return text unless text[ 0                          ] is '"'
    return text unless text[ last_idx = text.length - 1 ] is '"'
    return text[ 1 ... last_idx ]

  #---------------------------------------------------------------------------------------------------------
  _populate_xsampa_to_ipa: ->
    @_truncate_xsipa()
    line_nr     = 0
    xs_by_ipa   = {} ### #cache ###
    insert      = @db.prepare @sql.insert_xsipa
    @db =>
      for line from guy.fs.walk_lines @cfg.xsipa_path
        line_nr++
        line              = line.trim()
        continue if line.length is 0
        continue if line.startsWith '#'
        fields            = line.split '\t'
        fields[ idx ]     = field.trim() for field, idx in fields
        # fields[ idx ]     = null for field, idx in fields when field is 'N/A'
        [ xs
          ipa
          _
          description
          example ]       = fields
        example          ?= "(no example)"
        example           = @_undoublequote example
        example           = example.replace /\\"/g, '"'
        xs_by_ipa[ ipa ]  = xs ### #cache ###
        insert.run { description, xs, ipa, example, }
      return null
    xs_by_ipa = guy.lft.freeze xs_by_ipa ### #cache ###
    guy.props.def @, 'xs_by_ipa', { enumerable: false, value: xs_by_ipa, } ### #cache ###
    return null

  #=========================================================================================================
  #
  #---------------------------------------------------------------------------------------------------------
  # ipa_from_arpabet_s_1: ( abs0 ) ->
  #   R = abs0.replace /\b[\S]+?\b/g, ( match ) =>
  #     match = match.replace /\d+$/, ''
  #     return @ipa_by_ab2[ match ] ? '?'
  #   return R.replace /\s/g, ''

  #---------------------------------------------------------------------------------------------------------
  _build_cache_ipa_raw_from_arpabet2: ->
    R = {}
    for row from @db SQL"select * from #{@cfg.schema}.trlits where nick = 'ab2';"
      R[ row.trlit ] = row.ipa
    debug '^334^', R
    return R

  #---------------------------------------------------------------------------------------------------------
  ipa_raw_from_arpabet2: ( ab ) ->
    cache       = ( @cache.ipa_raw_from_arpabet2 ?= @_build_cache_ipa_raw_from_arpabet2() )
    replacement = @constructor.C.replacement
    R           = []
    for phone in ab.split /\x20+/
      stress  = null
      if ( match = phone.match /^(?<base>\D+)(?<level>\d*)$/ )?
        { base
          level } = match.groups
        mark      = { '': '', '0': '', '1': '̲', '2': '̤', }[ level ]
        # mark      = { '': '', '0': '', '1': '̅', '2': '̤', }[ level ]
        for letter in Array.from ( cache[ base ] ? replacement )
          R.push letter + mark
      else
        R.push cache[ phone ] ? replacement
      # debug '^444^', { mark, base, }
      # return mark + base
      # return base
    return R.join ' '

  # #---------------------------------------------------------------------------------------------------------
  # xsampa_from_ipa: ( ipa ) ->
  #   R = ( d for d in ( Array.from ipa ) when d not in [ '̲', '̤', ] )
  #   return ( @xs_by_ipa[ letter ] ? '█' for letter, idx in R ).join ''

  #---------------------------------------------------------------------------------------------------------
  _rewrite_arpabet_s: ( abs0 ) ->
    R = abs0
    R = R.replace /\bah([02])\b/g,  'ax$1'
    R = R.replace /\ber0\b/g,       'ax0 r'
    R = R.replace /\ber1\b/g,       'ex1 r'
    R = R.replace /\ber2\b/g,       'ex2 r'
    return R


