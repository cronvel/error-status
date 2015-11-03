/*
	The Cedric's Swiss Knife (CSK) - CSK Error Status

	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/



function ErrorStatus( args )
{
	this.type = null ;
	this.code = null ;
	this.message = null ;
	this.httpStatus = null ;
	this.stack = null ;
	
	if ( args !== null && typeof args === 'object' ) { this.set( args ) ; }
}

ErrorStatus.prototype = Object.create( Error.prototype ) ;
ErrorStatus.prototype.constructor = ErrorStatus ;

module.exports = ErrorStatus ;



ErrorStatus.prototype.set = function( args )
{
	if ( typeof args === 'object' )
	{
		if ( typeof args.type === 'string' ) { this.type = args.type ; }
		if ( typeof args.code === 'string' || typeof args.code === 'number' ) { this.code = args.code ; }
		if ( typeof args.message === 'string' ) { this.message = args.message ; }
		if ( typeof args.httpStatus === 'number' ) { this.httpStatus = args.httpStatus ; }
		
		this.name = this.code || this.type || 'ErrorStatus' ;
		
		if ( args.stack )
		{
			if ( args.stack === true && Error.captureStackTrace ) { Error.captureStackTrace( this , ErrorStatus[ this.type ] ) ; }
			else if ( typeof args.stack === 'string' ) { this.stack = args.stack ; }
		}
	}
} ;



ErrorStatus.prototype.sendHttpHeaders = function( httpResponse )
{
	if ( typeof this.httpStatus === 'number' ) { httpResponse.statusCode = this.httpStatus ; }
	if ( this.type !== null ) { httpResponse.setHeader( 'X-Error-Type' , this.type ) ; }
	if ( this.code !== null ) { httpResponse.setHeader( 'X-Error-Code' , this.code ) ; }
	if ( this.message !== null ) { httpResponse.setHeader( 'X-Error-Message' , this.message ) ; }
} ;



ErrorStatus.unserialize = function( json )
{
	var errorStatus = new ErrorStatus() ;
	
	// Real unserialization may have been made elsewhere
	if ( typeof json === 'string' )
	{
		try {
			json = JSON.parse( json ) ;
		}
		catch( error ) {
			return ErrorStatus.badRequest() ;
		}
	}
	else if ( typeof json !== 'object' )
	{
		return ErrorStatus.badRequest() ;
	}
	
	errorStatus.set( json ) ;
	
	return errorStatus ;
} ;



// Usual shortcut, for standard error conventions

// The request is not well formed or some arguments are not well formed or missing
ErrorStatus.badRequest = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'badRequest' ;
	args.httpStatus = 400 ;
	return new ErrorStatus( args ) ;
} ;



// The request may have succeded in another context (for example: the requester try to log out but has never logged in)
ErrorStatus.badContext = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'badContext' ;
	args.httpStatus = 424 ;
	return new ErrorStatus( args ) ;
} ;



// The requester is not allowed to do that
ErrorStatus.forbidden = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'forbidden' ;
	args.httpStatus = 403 ;
	return new ErrorStatus( args ) ;
} ;



// Failed login, or not logged yet
ErrorStatus.unauthorized = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'unauthorized' ;
	args.httpStatus = 401 ;
	return new ErrorStatus( args ) ;
} ;



// The argument or data didn't match anything
ErrorStatus.notFound = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'notFound' ;
	args.httpStatus = 404 ;
	return new ErrorStatus( args ) ;
} ;



// The argument or data didn't match anything
ErrorStatus.methodNotAllowed = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'methodNotAllowed' ;
	args.httpStatus = 405 ;
	return new ErrorStatus( args ) ;
} ;



// The argument or data are conflicting with another server's side existing data
ErrorStatus.conflict = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'conflict' ;
	args.httpStatus = 409 ;
	return new ErrorStatus( args ) ;
} ;



// Something fails internally
ErrorStatus.internalError = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'internalError' ;
	args.httpStatus = 500 ;
	return new ErrorStatus( args ) ;
} ;



// Something timeout...
ErrorStatus.timeout = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'timeout' ;
	
	// HTTP - 408: Request Timeout (client side), 503: Service Unavailable, 504: Gateway Timeout... 
	// There is nothing really suitable for a general timeout code, 408 can confuse the client too much, 504 looks the best.
	args.httpStatus = 504 ;
	
	return new ErrorStatus( args ) ;
} ;



// Something is too big (consume too much memory, exceed size limit, etc)
ErrorStatus.tooLarge = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'tooLarge' ;
	args.httpStatus = 413 ;
	return new ErrorStatus( args ) ;
} ;



// DEPRECATED version of tooLarge
ErrorStatus.overflow = function( args )
{
	if ( ! args || typeof args !== 'object' ) { args = {} ; }
	args.type = 'overflow' ;
	args.httpStatus = 413 ;
	return new ErrorStatus( args ) ;
} ;



