'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const mustache = require('mustache');
const Path = require('path');
const { URL } = require('url');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';
const storage = multer.memoryStorage();
const upload = multer({ storage });

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.model = model;
  process.chdir(__dirname);
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app, TEMPLATES_DIR);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  //@TODO add appropriate routes
  const base = app.locals.base;
  app.get(`${base}/search`, goSearch(app));     // search page
  app.get(`${base}/add_document`, goAdd(app));  // add page
  app.post(`${base}/add_document/upload`, upload.single('file'), doAdd(app)); // add action
  app.get(`${base}/:id`, getContents(app));		// contents for a doc
  app.get(`${base}`, goHome(app));              // home page
  app.get('', redirect(app));
}

/*************************** Action Routines ***************************/
  function redirect(app) {
  	return async function(req, res) {
  		return res.redirect(`${app.locals.base}`);
  	}
  }

  function goHome(app) {
    return errorWrap(async function(req, res) {
      try {
        await fs.readFile("statics/home.html", function(err, data) {
          if(err) throw err;
          let html = data.toString();
          res.send(html);
        });
      } catch (err) {
        console.error(err);
      }
    });
  }

  function goSearch(app) {
  	return async function(req, res) {
  		try {
  			if(req.query.query !== undefined) {
	  			const terms = req.query.query;
	  			let count = undefined;
	  			let start = undefined;
	  			if(req.query.count !== undefined)	count = req.query.count;
	  			if(req.query.start !== undefined)	start = req.query.start;
	  			const results = await app.locals.model.find(terms, start, count);

	  			/* altering links for self, next, prev searches */
	  			
	  			let links_adjusted = results.links;
	  			for(let i = 0; i < links_adjusted.length; i++) {
	  				let x = (links_adjusted[i].href).match(/\?q=(\S)+/)[0];
	  				let tmp = `${app.locals.base}/search?query=${x.substring(3)}`;
	  				links_adjusted[i].href = tmp;
	  			}

	  			/* altering the results lines to allow for highlighting search term */
	  			let termsArr = terms.split(" ");
	  			for(let i = 0; i < results.results.length; i++) {
	  				if(results.results[i].lines.length > 1) {
	  					for(let j = 0; j < results.results[i].lines.length; j++) {
	  						const REGEX = new RegExp(`${termsArr[j]}`, 'i');
	  						const line = results.results[i].lines[j];
	  						const ind  = line.match(REGEX).index;
	  						let p1 = line.substring(0, ind);
	  						let p2 = line.substring(ind + termsArr[j].length)
	  						const termInst = line.substring(ind, ind + termsArr[j].length);
	  						const obj = {
	  							p1: p1,
	  							p2: p2,
	  							term: termInst
	  						};
	  						results.results[i].lines[j] = obj;
	  					}
	  				} else {
	  					const line = results.results[i].lines[0];
	  					const REGEX = new RegExp(`${termsArr[0]}`, 'i');
	  					const ind = line.match(REGEX).index;
	  					let p1 = line.substring(0, ind);
	  					let p2 = line.substring(ind + termsArr[0].length);
	  					const termInst = line.substring(ind, ind + termsArr[0].length);
	  					const obj = {
	  						p1: p1,
	  						p2: p2,
	  						term: termInst
	  					};
	  					results.results[i].lines[0] = obj;
	  				}
	  			}
	  			
	  			const model = { base: app.locals.base, query: terms, results: results.results,
	  				links: results.links };

	  			const html = doMustache(app, 'find_results', model);
	  			res.send(html);
	  		}

	  		else {
		  		await fs.readFile("statics/search.html", function (err, data) {
			    	if(err) throw err;
			    	let html = data.toString();
			    	res.send(html);	
				});
	  		}
  		} catch (err) {
  			console.error(err);
  		}
  	}
  }

  function getContents(app) {
  	return async function(req, res) {
  		const name = req.params.id;
  		const results = await app.locals.model.get(name);

  		const model = { base: app.locals.base, name: name, 
  			content: results.content };

  		const html = doMustache(app, 'get_results', model);
  		res.send(html);
  	};
  }

  function goAdd(app) {
    return async function(req, res) {
    	await fs.readFile("statics/add.html", function(err, data) {
    		if(err) throw err;
    		let html = data.toString();
    		res.send(html);
    	});
    };
  }

  function doAdd(app) {
  	return async function(req, res) {
  		let fileName = req.file.originalname;
  		fileName = fileName.substring(0, fileName.length-4);
  		const fileContents = req.file.buffer.toString();

  		const results = await app.locals.model.create(fileName, fileContents);
  		
  		res.redirect(`${app.locals.base}/${fileName}`);
  	};
  }

  function errorWrap(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (err) {
        next(err);
      }
    };
  }

/************************ General Utilities ****************************/

/** return object containing all non-empty values from object values */
function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    const v = values[k];
    if (v && v.trim().length > 0) out[k] = v.trim();
  });
  return out;
}


/** Return a URL relative to req.originalUrl.  Returned URL path
 *  determined by path (which is absolute if starting with /). For
 *  example, specifying path as ../search.html will return a URL which
 *  is a sibling of the current document.  Object queryParams are
 *  encoded into the result's query-string and hash is set up as a
 *  fragment identifier for the result.
 */
function relativeUrl(req, path='', queryParams={}, hash='') {
  const url = new URL('http://dummy.com');
  url.protocol = req.protocol;
  url.hostname = req.hostname;
  url.port = req.socket.address().port;
  url.pathname = req.originalUrl.replace(/(\?.*)?$/, '');
  if (path.startsWith('/')) {
    url.pathname = path;
  }
  else if (path) {
    url.pathname += `/${path}`;
  }
  url.search = '';
  Object.entries(queryParams).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  url.hash = hash;
  return url.toString();
}

/************************** Template Utilities *************************/


/** Return result of mixing view-model view into template templateId
 *  in app templates.
 */
function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

/** Add contents all dir/*.ms files to app templates with each 
 *  template being keyed by the basename (sans extensions) of
 *  its file basename.
 */
function setupTemplates(app, dir) {
  app.templates = {};
  for (let fname of fs.readdirSync(dir)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

