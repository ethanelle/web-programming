'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const process = require('process');
const url = require('url');
const queryString = require('querystring');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;


//Main URLs
const DOCS = '/docs';
const COMPLETIONS = '/completions';

//Default value for count parameter
const COUNT = 5;

/** Listen on port for incoming requests.  Use docFinder instance
 *  of DocFinder to access document collection methods.
 */
function serve(port, docFinder) {
  const app = express();
  app.locals.port = port;
  app.locals.finder = docFinder;
  setupRoutes(app);
  const server = app.listen(port, async function() {
    console.log(`PID ${process.pid} listening on port ${port}`);
  });
  return server;
}

module.exports = { serve };

function setupRoutes(app) {
  app.use(cors());            //for security workaround in future projects
  app.use(bodyParser.json()); //all incoming bodies are JSON

  //@TODO: add routes for required 4 services
  const finder = app.locals.finder;
  app.get('/docs/:id', doGetContent(app));
  app.get('/docs?:id', doFind(app));
  app.get('/completions?:id', doCompletions(app));
  app.post('/docs', doAddContent(app));

  app.use(doErrors()); //must be last; setup for server errors   
}

//@TODO: add handler creation functions called by route setup
//routine for each individual web service.  Note that each
//returned handler should be wrapped using errorWrap() to
//ensure that any internal errors are handled reasonably.

/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
 */ 
function doGetContent(app) {
  return errorWrap(async function(req, res) {
    try {
		const id = req.params.id;
		const results = await app.locals.finder.docContent(id);
		const links = [{'rel': 'self','href': baseUrl(req, `${DOCS}/${id}`)}];
		res.status(OK).json([{'content': results}, {'links': links}]);
    } catch(err) {
    	res.status(NOT_FOUND).
    		json([{'code': 'NOT_FOUND', 'message': `doc ${req.params.id} not found`}]);
    }
  });
}

function doAddContent(app) {
  return errorWrap(async function(req, res) {
    try {
      	const obj = req.body;
      	await app.locals.finder.addContent(obj.name, obj.content);
     	res.status(CREATED).json([{'href': baseUrl(req, `${DOCS}/${obj.name}`)}]);
     	res.append('Location', baseUrl(req, `${DOCS}/${obj.name}`));
    } catch(err) {
      	res.status(BAD_REQUEST).
      		json([{'code': 'BAD_REQUEST', 'message': `request body incorrect, usage: \'name: name content: content\'`}]);
    }
  });
}

function doFind(app) {
  return errorWrap(async function(req, res) {
    try {
    	// set up query processing
      const terms = (req.query.q).replace(/%20/g, '+').split('+');
      const start = Number((req.query.start) ? req.query.start : 0);
      const count = Number((req.query.count) ? req.query.count : COUNT);
      	// get query results from finder
      const results = await app.locals.finder.find(terms);
      const resultsTrimmed = results.slice(start).slice(0, count);
      	// set up links for HTTP response
      let links = [];
      	// SELF link
      links.push({'rel': 'self',
      	'href': baseUrl(req, `${DOCS}?q=${req.query.q}&start=${start}&count=${count}`)});
      	// Check if next and/or previous are needed
      if(results.length > count) {
     	// need a previous link
      	if(start > 0) {
      		let startPrev = (start - count >= 0) ? (start - count) : 0;
      		links.push({'rel':'previous', 
      			'href': baseUrl(req, `${DOCS}?q=${req.query.q}&start=${startPrev}&count=${count}`)});
      	}
      	// need a next link
      	if(start + count < results.length) {
      		const startNext = Number(start + count);
      		links.push({'rel': 'next', 
      			'href': baseUrl(req, `${DOCS}?q=${req.query.q}&start=${startNext}&count=${count}`)});
      	}
      }
      res.json([{'results': resultsTrimmed}, {'totalCount': results.length}, {'links': links}]);
      res.sendStatus(OK);
    } catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doCompletions(app) {
  return errorWrap(async function(req, res) {
    try {
      const text = req.query.text;
      let results = await app.locals.finder.complete(text);
      let swaps = false;
      do {
      	swaps = false;
      	for(let i = 0 ; i < results.length-1; i++) {
      		if(results[i] > results[i+1]) {
      			let tmp = results[i];
      			results[i] = results[i+1];
      			results[i+1] = tmp;
      			swaps = true;
      		}
      	}
      }while(swaps)
      res.json(results);
      res.sendStatus(OK);
    } catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}
  

/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}

const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND,
}

function mapError(err) {
  console.error(err);
  if(err.isDomain) {
    return {
      status: (ERROR_MAP[err.errorCode] || BAD_REQUEST),
      code: err.errorCode,
      message: err.message
    };
  } else {
    return {
      status: SERVER_ERROR,
      code: 'INTERNAL',
      message: err.toString()
    };
  }
}