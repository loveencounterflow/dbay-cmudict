
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
    guy.props.def me, 'db', { enumerable: false, value: db, }
    me.cfg        = guy.lft.freeze guy.obj.omit_nullish me.cfg
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
      drop index if exists #{schema}.entries_abs0_idx;
      drop index if exists #{schema}.entries_abs1_idx;
      drop index if exists #{schema}.entries_xsampa_idx;
      drop index if exists #{schema}.entries_ipa_idx;
      drop table if exists #{schema}.entries;
      drop table if exists #{schema}.abipa;
      drop table if exists #{schema}.xsipa;
      -- ...................................................................................................
      vacuum #{schema};
      -- ...................................................................................................
      create table #{schema}.entries (
          id        integer not null primary key,
          word      text    not null,
          abs0      text    not null,
          abs1      text    not null,
          xsampa    text    not null,
          ipa       text    not null );
      create index #{schema}.entries_word_idx
        on entries ( word );
      create index #{schema}.entries_abs0_idx
        on entries ( abs0 );
      create index #{schema}.entries_abs1_idx
        on entries ( abs1 );
      create index #{schema}.entries_xsampa_idx
        on entries ( xsampa );
      create index #{schema}.entries_ipa_idx
        on entries ( ipa );
      create table #{schema}.abipa (
        cv          text    not null,
        ab1         text,
        ab2         text    not null primary key,
        ipa         text    not null,
        example     text    not null );
      create table #{schema}.xsipa (
        description text,
        xs          text    not null primary key,
        ipa         text    not null,
        example     text    not null );
      """
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_sql: ->
    { prefix
      schema }  = @cfg
    sql         =
      get_db_object_count:  SQL"select count(*) as count from #{schema}.sqlite_schema;"
      truncate_entries:     SQL"delete from #{schema}.entries;"
      truncate_abipa:       SQL"delete from #{schema}.abipa;"
      truncate_xsipa:       SQL"delete from #{schema}.xsipa;"
      insert_entry: SQL"""
        insert into #{schema}.entries ( word, abs0, abs1, xsampa, ipa )
          values ( $word, $abs0, $abs1, $xsampa, $ipa );"""
      insert_abipa: SQL"""
        insert into #{schema}.abipa ( cv, ab1, ab2, ipa, example )
          values ( $cv, $ab1, $ab2, $ipa, $example );"""
      insert_xsipa: SQL"""
        insert into #{schema}.xsipa ( description, xs, ipa, example )
          values ( $description, $xs, $ipa, $example );"""
    guy.props.def @, 'sql', { enumerable: false, value: sql, }
    return null

  #---------------------------------------------------------------------------------------------------------
  _create_sql_functions: ->
    { prefix
      schema } = @cfg
    # #.......................................................................................................
    # @dba.create_function
    #   name:           "#{prefix}_tags_from_id",
    #   deterministic:  true,
    #   varargs:        false,
    #   call:           ( id ) =>
    #     fallbacks = @get_filtered_fallbacks()
    #     tagchain  = @tagchain_from_id { id, }
    #     tags      = @tags_from_tagchain { tagchain, }
    #     return JSON.stringify { fallbacks..., tags..., }
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _get_db_object_count: -> @db.single_value @sql.get_db_object_count
  _truncate_entries:    -> @db @sql.truncate_entries
  _truncate_abipa:      -> @db @sql.truncate_abipa
  _truncate_xsipa:      -> @db @sql.truncate_xsipa

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
    @_populate_arpabet_to_ipa()
    @_populate_xsampa_to_ipa()
    @_populate_entries()

  #---------------------------------------------------------------------------------------------------------
  _populate_entries: ->
    count = 0
    @_truncate_entries()
    insert = @db.prepare @sql.insert_entry
    @db =>
      for line from guy.fs.walk_lines @cfg.source_path
        continue if line.startsWith ';;;'
        line                  = line.trimEnd()
        [ word, abs0,  ]      = line.split '\x20\x20'
        word                  = word.trim()
        continue if ( word.endsWith "'S" ) or ( word.endsWith "'" )
        continue if ( word.match /'S\(\d\)$/ )?
        unless word? and word.length > 0 and abs0? and abs0.length > 0
          warn '^4443^', count, ( rpr line )
          continue
        #...................................................................................................
        count++
        if count > @cfg.max_entry_count
          warn '^dbay-cmudict/main@1^', "shortcutting at #{@cfg.max_entry_count} entries"
          break
        word      = word.toLowerCase()
        abs0      = abs0.trim()
        abs1      = @_rewrite_arpabet_s abs0.toLowerCase()
        ipa       = @ipa_from_abs1 abs1
        xsampa    = @xsampa_from_ipa  ipa
        insert.run { word, abs0, abs1, xsampa, ipa, }
      return null
    return null

  #---------------------------------------------------------------------------------------------------------
  _populate_arpabet_to_ipa: ->
    @_truncate_abipa()
    line_nr     = 0
    ipa_by_ab2  = {} ### #cache ###
    insert      = @db.prepare @sql.insert_abipa
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
        ipa_by_ab2[ ab2 ] = ipa ### #cache ###
        insert.run { cv, ab1, ab2, ipa, example, }
      return null
    ipa_by_ab2 = guy.lft.freeze ipa_by_ab2 ### #cache ###
    guy.props.def @, 'ipa_by_ab2', { enumerable: false, value: ipa_by_ab2, } ### #cache ###
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
  ipa_from_abs1: ( abs1 ) ->
    R = []
    for phone in abs1.split '\x20'
      stress  = null
      if ( match = phone.match /^(?<base>\D+)(?<level>\d*)$/ )?
        { base
          level } = match.groups
        mark      = { '': '', '0': '', '1': '̲', '2': '̤', }[ level ]
        # mark      = { '': '', '0': '', '1': '̅', '2': '̤', }[ level ]
        for letter in Array.from ( @ipa_by_ab2[ base ] ? '█' )
          R.push letter + mark
      else
        R.push @ipa_by_ab2[ phone ] ? '█'
      # debug '^444^', { mark, base, }
      # return mark + base
      # return base
    return R.join ''

  #---------------------------------------------------------------------------------------------------------
  xsampa_from_ipa: ( ipa ) ->
    R = ( d for d in ( Array.from ipa ) when d not in [ '̲', '̤', ] )
    return ( @xs_by_ipa[ letter ] ? '█' for letter, idx in R ).join ''

  #---------------------------------------------------------------------------------------------------------
  _rewrite_arpabet_s: ( abs0 ) ->
    R = abs0
    R = R.replace /\bah([02])\b/g,  'ax$1'
    R = R.replace /\ber0\b/g,       'ax0 r'
    R = R.replace /\ber1\b/g,       'ex1 r'
    R = R.replace /\ber2\b/g,       'ex2 r'
    return R


