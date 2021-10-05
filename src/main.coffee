
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
        db:         null
        prefix:     'cmud_'
        schema:     'cmud'
        path:       PATH.resolve PATH.join __dirname, '../cmudict.sqlite'
        create:     false

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
    @open_cmu_db()
    return undefined

  #---------------------------------------------------------------------------------------------------------
  _create_db_structure: ->
    { prefix
      schema } = @cfg
    @db.execute SQL"""
      create table if not exists #{schema}.entries (
          id        integer not null primary key,
          word      text    not null,
          arpabet_s text    not null );"""
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_sql: ->
    { prefix
      schema }  = @cfg
    schema_i    = @db.sql.I schema
    sql         =
      get_db_object_count: SQL"select count(*) as count from #{schema_i}.sqlite_schema;"
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
  _get_db_object_count: ->
    @db.single_value @sql.get_db_object_count

  #---------------------------------------------------------------------------------------------------------
  open_cmu_db: ->
    { prefix
      schema
      path
      create } = @cfg
    @db.open { path, schema, }
    debug '^938^', @_get_db_object_count()
    if create or ( @_get_db_object_count() is 0 )
      @_create_db_structure()
      @_populate_db()
    else
      null
    return null





