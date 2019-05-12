const assert = require('assert');
const mongoClient = require('mongodb').MongoClient;
const Db = require('mongodb').Db;
const Server = require('mongodb').Server;

const {inspect} = require('util'); //for debugging

'use strict';

/** This class is expected to persist its state.  Hence when the
 *  class is created with a specific database url, it is expected
 *  to retain the state it had when it was last used with that URL.
 */ 
class DocFinder {

  /** Constructor for instance of DocFinder. The dbUrl is
   *  expected to be of the form mongodb://SERVER:PORT/DB
   *  where SERVER/PORT specifies the server and port on
   *  which the mongo database server is running and DB is
   *  name of the database within that database server which
   *  hosts the persistent content provided by this class.
   *  PROBABLY MORE TODO
   */
  constructor(dbUrl) {
  	this.dbUrl  = dbUrl;
    this.dbName = dbUrl.match(/\d\/\w+/).toString().substring(2);
    this.dbPort = dbUrl.match(/:\d+/).toString().substring(1);
    this.dbHost = dbUrl.match(/:\/\/\w+:/).toString().replace(/\/|:/g, '');
    this.db;
    this.dbConnection;
  }

  /** This routine is used for all asynchronous initialization
   *  for instance of DocFinder.  It must be called by a client
   *  immediately after creating a new instance of this.
   */
  async init() {
    try {
      let connection = await mongoClient.connect(this.dbUrl, MONGO_OPTIONS);
      this.dbConnection = connection;
      this.db = await connection.db(this.dbName);
      // console.log("Successful connection to database.");
    }
    catch (ex) {
      console.log("Failed connection to database.");
    }
  }

  /** Release all resources held by this doc-finder.  Specifically,
   *  close any database connections.
   */
  async close() {
    await this.dbConnection.close();
  }

  /** Clear database */
  async clear() {
    await this.db.collection("noiseWords").deleteMany({});
    await this.db.collection("documents").deleteMany({});
    await this.db.collection("words").deleteMany({});
    // console.log("Cleared database.");
  }

  /** Return an array of non-noise normalized words from string
   *  contentText.  Non-noise means it is not a word in the noiseWords
   *  which have been added to this object.  Normalized means that
   *  words are lower-cased, have been stemmed and all non-alphabetic
   *  characters matching regex [^a-z] have been removed.
   */
  async words(contentText) {
    let noise = new Set();
    let result = await this.db.collection("noiseWords").find().toArray();
    let map = result.map(x => x._id);
    noise = new Set(map);

    return contentText.
      replace(/\s+/g, " ").
      split(" ").
      map(x => normalize(x)).
      filter(x => x.length > 0).
      filter(x => !(noise.has(x)));
  }

  /** Add all normalized words in the noiseText string to this as
   *  noise words.  This operation should be idempotent.
   */
  async addNoiseWords(noiseText) {
    let arr = noiseText.replace(/\n/g, " ").split(" ");

    await this.upsertEntries("noiseWords", arr);
  }

  /** Add document named by string name with specified content string
   *  contentText to this instance. Update index in this with all
   *  non-noise normalized words in contentText string.
   *  This operation should be idempotent.
   */ 
  async addContent(name, contentText) {
    let text = await this.words(contentText);
    let obj = {
      _id: name,
      contents: contentText,
      words: text
    }
    let query = { _id: name };
    let docInsertResult = await this.db.collection("documents").
      updateOne({"_id": name}, {$set: {"contents": contentText, "words": text}}, {upsert: true});
      
    /* create list of searchable words from obj.words */
    await this.upsertEntries("words", obj.words);
  }

  /** Return contents of document name.  If not found, throw an Error
   *  object with property code set to 'NOT_FOUND' and property
   *  message set to `doc ${name} not found`.
   */
  async docContent(name) {
    let result = await this.db.collection("documents").findOne({_id: name});
    if(result) {
      console.log(result);
      return result.contents;
    }else {
      console.error(`doc ${name} not found`);
      return "";
    }
  }
  
  /** Given a list of normalized, non-noise words search terms, 
   *  return a list of Result's  which specify the matching documents.  
   *  Each Result object contains the following properties:
   *
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  The 
   *            lines must have the same relative order as in the source
   *            document.  Note that if a line contains multiple search 
   *            terms, then it will occur only once in lines.
   *
   *  The returned Result list must be sorted in non-ascending order
   *  by score.  Results which have the same score are sorted by the
   *  document name in lexicographical ascending order.
   *
   */
  async find(terms) {
    let retVal = new Array();
    let documents = await this.db.collection("documents").find().toArray();
    if(documents.length < 1) {
      return new Array();
    }

    // Searching begins
    for(let term of terms) {
      let REG_TERM = new RegExp("\\b" + term + "\\b", "i");
      let FLAGGED_REG_TERM = new RegExp("\\b" + term + "\\b", "g");
      documents.forEach((doc) => {
        if(doc.words.includes(term)) {
          //documents contains term
          let score = 0;
          for(let i = 0; i < doc.words.length; i++) {
            if(doc.words[i] === term)
              score++;
          }
          let name = doc._id;
          let line = doc.contents.substring(
            doc.contents.lastIndexOf('\n', doc.contents.regexIndexOf(REG_TERM)) + 1,
            doc.contents.indexOf('\n', doc.contents.regexIndexOf(REG_TERM))
          );

          // insert results to retVal array
          let retTitles = retVal.map(x => x.name) || [];
          if(retTitles.length > 0 && retTitles.includes(name)) {
            let ind = retVal.findIndex(x => x.name == name);
            score += retVal[ind].score;
            let oldLine = retVal[ind].lines;
            oldLine = oldLine + "\n" + line;
            retVal[ind] = new Result(name, score, oldLine);
          }else {
            retVal.push(new Result(name, score, line));
          }
        }
      });
    }
    /* sorting time */
    retVal = await this.sortResults(retVal);
    return retVal;
  }

  /** Given a text string, return a ordered list of all completions of
   *  the last normalized word in text.  Returns [] if the last char
   *  in text is not alphabetic.
   */
  async complete(text) {
    let words = await this.db.collection("words").find().toArray();
    let REG_TEXT = new RegExp("\\b" + text);
    let ALPHA = new RegExp(/[a-zA-Z]/);
    words = words.map(x => x = x._id);
    let matches = [];
    if(text.slice(-1).match(ALPHA)) {
      for(let i = 0; i < words.length; i++) {
        if(words[i].match(REG_TEXT))
          matches.push(words[i]);
      }
    }
    // check if needs sorting
    if(matches.length > 1) {
      let swaps = false;
      do {
        swaps = false;
        for(let i = 0; i < matches.length - 1; i++) {
          if(matches[i] > matches[i+1]) {
            swaps = true;
            let tmp = matches[i];
            matches[i] = matches[i+1];
            matches[i+1] = tmp;
          }
        }
      }while(swaps)
    }
    return matches;
  }

  async upsertEntries(collect, entries) {
    let col = this.db.collection(collect);
    let bulkUpdateOps = [];

    entries.forEach(function(doc) {
      bulkUpdateOps.push({ "updateOne": { "filter": {"_id": doc}, "update": {"_id": doc}, "upsert": true } });
      if(bulkUpdateOps.length === 1000) {
        col.bulkWrite(bulkUpdateOps, {ordered: false}).then(function(r) {
          if(!r)
            console.error("There was an error inserting.")
        });
        bulkUpdateOps = [];
      }
    })
    
    if(bulkUpdateOps.length > 0) {
      col.bulkWrite(bulkUpdateOps, {ordered: false}).then(function(r) {
        if(!r)
          console.error("There was an error inserting.")
      });
    }
//    console.log(`Insertion complete`);
  }

  async sortResults(results) {
    let swaps = false;
    do {
      swaps = false;
      for(let i = 0; i < results.length - 1; i++) {
        // swapped for lesser score being first
        if(results[i].score < results[i+1].score) {
          swaps = true;
          let tmp = results[i];
          results[i] = results[i+1];
          results[i+1] = tmp;
        }
        // swapped for lexigraphically greater name being first on score tie 
        else if(results[i].score === results[i+1].score) {
          if(results[i].name > results[i+1].name) {
            swaps = true;
            let tmp = results[i];
            results[i] = results[i+1];
            results[i+1] = tmp;
          }
        }
      }
    }while(swaps);
    return results;
  }

  //Add private methods as necessary


} //class DocFinder

module.exports = DocFinder;

/**
  * Following two additions to String for use in DocFinder.find()
  * Retrieved from: https://stackoverflow.com/questions/273789/is-there-a-version-of-javascripts-string-indexof-that-allows-for-regular-expr
  */
String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf = this.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

String.prototype.regexLastIndexOf = function(regex, startpos) {
    regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
    if(typeof (startpos) == "undefined") {
        startpos = this.length;
    } else if(startpos < 0) {
        startpos = 0;
    }
    var stringToWorkWith = this.substring(0, startpos + 1);
    var lastIndexOf = -1;
    var nextStop = 0;
    while((result = regex.exec(stringToWorkWith)) != null) {
        lastIndexOf = result.index;
        regex.lastIndex = ++nextStop;
    }
    return lastIndexOf;
}

//Add module global functions, constants classes as necessary
//(inaccessible to the rest of the program).

//Used to prevent warning messages from mongodb.
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple utility class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */ 
class Result {
  constructor(name, score, lines) {
    this.name = name; this.score = score; this.lines = lines;
  }

  toString() { return `${this.name}: ${this.score}\n${this.lines}`; }
}

/** Compare result1 with result2: higher scores compare lower; if
 *  scores are equal, then lexicographically earlier names compare
 *  lower.
 */
function compareResults(result1, result2) {
  return (result2.score - result1.score) ||
    result1.name.localeCompare(result2.name);
}

/** Normalize word by stem'ing it, removing all non-alphabetic
 *  characters and converting to lowercase.
 */
function normalize(word) {
  return stem(word.toLowerCase()).replace(/[^a-z]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
  return word.replace(/\'s$/, '');
}


