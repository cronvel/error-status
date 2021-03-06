/*
	Error Status

	Copyright (c) 2015 - 2021 Cédric Ronvel

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

"use strict" ;



function ErrorStatus( args , from_ = null ) {
	this.type = null ;
	this.code = null ;
	this.at = null ;
	this.message = null ;
	this.safeMessage = null ;
	this.httpStatus = null ;
	this.from = from_ ;
	this.stack = null ;

	if ( args ) {
		this.set( args ) ;

		if ( args.capture ) {
			if ( typeof args.capture === 'function' ) {
				Error.captureStackTrace( this , args.capture ) ;
			}
			else {
				Error.captureStackTrace( this , ErrorStatus ) ;
			}
		}
		else if ( ErrorStatus.alwaysCapture ) {
			Error.captureStackTrace( this , ErrorStatus ) ;
		}
	}
	else if ( ErrorStatus.alwaysCapture ) {
		Error.captureStackTrace( this , ErrorStatus ) ;
	}
}

ErrorStatus.prototype = Object.create( Error.prototype ) ;
ErrorStatus.prototype.constructor = ErrorStatus ;

module.exports = ErrorStatus ;



// Turn that to true when debugging, or inside unit test
ErrorStatus.alwaysCapture = false ;



ErrorStatus.prototype.set = function( args ) {
	if ( ! args || typeof args !== 'object' ) { return ; }

	if ( args instanceof Error ) {
		// This is a wrapper around an error
		this.from = args ;

		if ( typeof args.type === 'string' ) { this.type = args.type ; }
		if ( typeof args.message === 'string' ) { this.message = args.message ; }
		if ( typeof args.safeMessage === 'string' ) { this.safeMessage = args.safeMessage ; }

		if ( typeof args.httpStatus === 'number' ) {
			this.httpStatus = args.httpStatus ;
		}
		else if ( ErrorStatus[ this.type ] && ErrorStatus[ this.type ].httpStatus ) {
			this.httpStatus = ErrorStatus[ this.type ].httpStatus ;
		}

		if ( typeof args.code === 'string' || typeof args.code === 'number' ) { this.code = args.code ; }
		else { this.code = args.constructor.name ; }

		if ( typeof args.at === 'string' ) { this.at = args.at ; }

		this.name = this.code || args.constructor.name || this.type || 'ErrorStatus' ;
		// Override the constructor
		if ( ErrorStatus[ this.type ] ) { this.constructor = ErrorStatus[ this.type ] ; }

		// Handle the stack property.
		// We cannot copy the value, it would format the stack immediately: we don't want that.
		// It appears that we cannot copy the descriptor either, it won't work.
		// So we call the orginal property.
		Object.defineProperty( this , 'stack' , {
			get: function() { return args.stack ; } ,
			set: function( val ) { args.stack = val ; }
		} ) ;
	}
	else {
		if ( typeof args.type === 'string' ) { this.type = args.type ; }
		if ( typeof args.code === 'string' || typeof args.code === 'number' ) { this.code = args.code ; }
		if ( typeof args.at === 'string' ) { this.at = args.at ; }
		if ( typeof args.message === 'string' ) { this.message = args.message ; }
		if ( typeof args.safeMessage === 'string' ) { this.safeMessage = args.safeMessage ; }
		if ( args.from && ( args.from instanceof Error ) ) { this.from = args.from ; }

		if ( typeof args.httpStatus === 'number' ) {
			this.httpStatus = args.httpStatus ;
		}
		else if ( ErrorStatus[ this.type ] && ErrorStatus[ this.type ].httpStatus ) {
			this.httpStatus = ErrorStatus[ this.type ].httpStatus ;
		}

		this.name = this.code || this.type || 'ErrorStatus' ;

		// Override the constructor
		if ( ErrorStatus[ this.type ] ) { this.constructor = ErrorStatus[ this.type ] ; }

		if ( args.stack ) {
			if ( args.stack === true && Error.captureStackTrace ) { Error.captureStackTrace( this , ErrorStatus[ this.type ] ) ; }
			else if ( typeof args.stack === 'string' ) { this.stack = args.stack ; }
		}
	}
} ;



// From string-kit's escape httpHeaderValue
// An header value accepts any non-control char of the ISO latin 1 charset (codepoint <= 255)
function httpHeaderValue( str ) {
	return str.replace( /[\x00-\x1f\u0100-\uffff\x7f%]/g , match => {
		try {
			return encodeURI( match ) ;
		}
		catch ( error ) {
			// encodeURI can throw on bad surrogate pairs, but we just strip those characters
			return '' ;
		}
	} ) ;
}



ErrorStatus.prototype.sendHttpHeaders =	// <-- DEPRECATED method name (1.7.0)
ErrorStatus.prototype.setHttpHeaders = function( httpResponse ) {
	if ( typeof this.httpStatus === 'number' ) { httpResponse.statusCode = this.httpStatus ; }
	if ( this.type !== null ) { httpResponse.setHeader( 'x-error-type' , this.type ) ; }
	if ( this.code !== null ) { httpResponse.setHeader( 'x-error-code' , this.code ) ; }
	if ( this.at !== null ) { httpResponse.setHeader( 'x-error-at' , this.at ) ; }

	if ( this.safeMessage !== null ) { httpResponse.setHeader( 'x-error-message' , httpHeaderValue( this.safeMessage ) ) ; }
	else if ( this.message !== null ) { httpResponse.setHeader( 'x-error-message' , httpHeaderValue( this.message ) ) ; }
} ;



ErrorStatus.prototype.toMessage = function() {
	return {
		event: 'error' ,
		type: this.type || null ,
		data: {
			code: this.code || null ,
			at: this.at || null ,
			message: this.message || null
		}
	} ;
} ;



ErrorStatus.fromMessage = function( message ) {
	var errorStatus ;

	if ( typeof message === 'string' ) {
		try {
			message = JSON.parse( message ) ;
		}
		catch ( error ) {
			return ErrorStatus.badRequest() ;
		}
	}

	if ( typeof message !== 'object' ) {
		return ErrorStatus.badRequest() ;
	}

	errorStatus = new ErrorStatus( { type: message.type || null } ) ;
	errorStatus.set( message.data ) ;

	return errorStatus ;
} ;



ErrorStatus.prototype.sendMessageStream = function( stream , callback ) {
	stream.write( JSON.stringify( this.toMessage() ) + '\n' , callback ) ;
} ;



ErrorStatus.unserialize = function( json ) {
	var errorStatus = new ErrorStatus() ;

	// Real unserialization may have been made elsewhere
	if ( typeof json === 'string' ) {
		try {
			json = JSON.parse( json ) ;
		}
		catch( error ) {
			return ErrorStatus.badRequest() ;
		}
	}

	if ( typeof json !== 'object' ) {
		return ErrorStatus.badRequest() ;
	}

	errorStatus.set( json ) ;

	return errorStatus ;
} ;



ErrorStatus.manageArgs = function( args ) {
	switch ( typeof args ) {
		case 'number' :
			return { code: args } ;
		case 'string' :
			return { message: args } ;
		case 'object' :
			return args ;
		default :
			return {} ;
	}
} ;



// Usual shortcut, for standard error conventions

// The request is not well formed or some arguments are not well formed or missing
ErrorStatus.badRequest = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'badRequest' ;
	args.httpStatus = 400 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.badRequest ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.badRequest.httpStatus = 400 ;



// The request may have succeded in another context (for example: the requester try to log out but has never logged in)
ErrorStatus.badContext = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'badContext' ;
	args.httpStatus = 424 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.badContext ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.badContext.httpStatus = 424 ;



// The requester is not allowed to do that
ErrorStatus.forbidden = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'forbidden' ;
	args.httpStatus = 403 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.forbidden ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.forbidden.httpStatus = 403 ;



// Failed login, or not logged yet
ErrorStatus.unauthorized = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'unauthorized' ;
	args.httpStatus = 401 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.unauthorized ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.unauthorized.httpStatus = 401 ;



// The argument or data didn't match anything
ErrorStatus.notFound = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'notFound' ;
	args.httpStatus = 404 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.notFound ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.notFound.httpStatus = 404 ;



// The argument or data didn't match anything
ErrorStatus.methodNotAllowed = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'methodNotAllowed' ;
	args.httpStatus = 405 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.methodNotAllowed ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.methodNotAllowed.httpStatus = 405 ;



// The argument or data are conflicting with another server's side existing data
ErrorStatus.conflict = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'conflict' ;
	args.httpStatus = 409 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.conflict ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.conflict.httpStatus = 409 ;



// Something fails internally
ErrorStatus.internalError = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'internalError' ;
	args.httpStatus = 500 ;

	// Internal errors always have a stack trace
	if ( args.capture === true || ! args.capture ) { args.capture = ErrorStatus.internalError ; }

	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.internalError.httpStatus = 500 ;



// Something timeout...
ErrorStatus.timeout = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'timeout' ;

	// HTTP - 408: Request Timeout (client side), 503: Service Unavailable, 504: Gateway Timeout...
	// There is nothing really suitable for a general timeout code, 408 can confuse the client too much, 504 looks the best.
	args.httpStatus = 504 ;

	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.timeout ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.timeout.httpStatus = 504 ;



// Something is too big (consume too much memory, exceed size limit, etc)
ErrorStatus.tooLarge = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'tooLarge' ;
	args.httpStatus = 413 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.tooLarge ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.tooLarge.httpStatus = 413 ;



// DEPRECATED version of tooLarge
ErrorStatus.overflow = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'overflow' ;
	args.httpStatus = 413 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.overflow ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.overflow.httpStatus = 413 ;



// Unsupported Media Type
ErrorStatus.unsupportedMediaType = function( args_ , from_ ) {
	var args = ErrorStatus.manageArgs( args_ ) ;
	args.type = 'unsupportedMediaType' ;
	args.httpStatus = 415 ;
	if ( args.capture === true || ( ! args.capture && ErrorStatus.alwaysCapture ) ) { args.capture = ErrorStatus.unsupportedMediaType ; }
	return new ErrorStatus( args , from_ ) ;
} ;

ErrorStatus.unsupportedMediaType.httpStatus = 415 ;

