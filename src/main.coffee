
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
        db:           null
        prefix:       'cmud_'
        schema:       'cmud'
        path:         PATH.resolve PATH.join __dirname, '../cmudict.sqlite'
        source_path:  PATH.resolve PATH.join __dirname, '../cmudict-0.7b'
        arpaipa_path: PATH.resolve PATH.join __dirname, '../arpabet-to-ipa.tsv'
        create:       false

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
      create table if not exists #{schema}.entries (
          id        integer not null primary key,
          word      text    not null,
          arpabet_s text    not null,
          ipa       text    not null );
      create index if not exists #{schema}.entries_word_idx
        on entries ( word );
      create table if not exists #{schema}.abipa (
        cv          text    not null,
        ab1         text,
        ab2         text    not null primary key,
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
      insert_entry: SQL"""
        insert into #{schema}.entries ( word, arpabet_s, ipa )
          values ( $word, $arpabet_s, $ipa );"""
      insert_abipa: SQL"""
        insert into #{schema}.abipa ( cv, ab1, ab2, ipa, example )
          values ( $cv, $ab1, $ab2, $ipa, $example );"""
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
    @_populate_entries()

  #---------------------------------------------------------------------------------------------------------
  _populate_entries: ->
    count = 0
    @_truncate_entries()
    insert = @db.prepare @sql.insert_entry
    @db =>
      for line from guy.fs.walk_lines @cfg.source_path
        continue if line.startsWith ';;;'
        line = line.trimEnd()
        [ word, arpabet_s, ] = line.split '\x20\x20'
        continue if ( word.endsWith "'S" ) or ( word.endsWith "'" )
        continue if ( word.match /'S\(\d\)$/ )?
        unless word? and word.length > 0 and arpabet_s? and arpabet_s.length > 0
          warn '^4443^', count, ( rpr line )
          continue
        count++
        ipa = @ipa_from_arpabet_s arpabet_s
        insert.run { word, arpabet_s, ipa, }
      return null
    return null

  #---------------------------------------------------------------------------------------------------------
  _populate_arpabet_to_ipa: ->
    @_truncate_abipa()
    line_nr     = 0
    ipa_by_ab2  = {}
    insert      = @db.prepare @sql.insert_abipa
    @db =>
      for line from guy.fs.walk_lines @cfg.arpaipa_path
        line_nr++
        continue if line.startsWith '#'
        fields            = line.split '\t'
        fields[ idx ]     = field.trim() for field, idx in fields
        fields[ idx ]     = null for field, idx in fields when field is 'N/A'
        [ cv
          ab1
          ab2
          ipa
          example ]       = fields
        example           = example.replace /\x20/g, ''
        ipa_by_ab2[ ab2 ] = ipa
        insert.run { cv, ab1, ab2, ipa, example, }
      return null
    ipa_by_ab2 = guy.lft.freeze ipa_by_ab2
    guy.props.def @, 'ipa_by_ab2', { enumerable: false, value: ipa_by_ab2, }
    return null

  #=========================================================================================================
  #
  #---------------------------------------------------------------------------------------------------------
  # ipa_from_arpabet_s_1: ( arpabet_s ) ->
  #   R = arpabet_s.replace /\b[\S]+?\b/g, ( match ) =>
  #     match = match.replace /\d+$/, ''
  #     return @ipa_by_ab2[ match ] ? '?'
  #   return R.replace /\s/g, ''

  #---------------------------------------------------------------------------------------------------------
  ipa_from_arpabet_s: ( arpabet_s ) ->
    R = arpabet_s.split '\x20'
    return ( @ipa_by_ab2[ ( phone.replace /\d+$/, '' ) ] ? '?' for phone, idx in R ).join ''



