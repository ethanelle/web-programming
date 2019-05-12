const {inspect} = require('util');

'use strict'

class DocFinder {
	constructor() {
		this.noiseList = new Set();
		this.contentList = new Array();
		this.wordList = new Array();
	}

	words(content) {
		let arr = content.split("\n");
		for(let i = 0; i < arr.length; i++) {
			arr[i] = normalize(arr[i]);
			const words = arr[i].split(" ");
			for(let j = 0; j < words.length; j++) {
				if(this.noiseList.has(words[j])) {
					let i = words.indexOf(words[j]);
					words.splice(i, 1);
				}
			}
			arr[i] = words.join(" ");
		}
		return arr;
	}

	addNoiseWords(noiseWords) {
		let arr = noiseWords.replace(/\n/g, " ").split(" ");
		let arrList = new Array(this.noiseList);
		arrList = arrList.concat(arr);
		this.noiseList = new Set(arrList);
	}

	addContent(name, content) {
		let OG = content.split("\n");
		content = this.words(content);

		let obj = {
			name: name,
			content: content,
			OG: OG
		};
		this.contentList.push(obj);

		for(let line of content) {
			let arr = line.split(" ");
			for(let word of arr) {
				if(this.wordList.indexOf(word) < 0)
					this.wordList.push(word);
			}
		}
	}

	/* 	should work just fine for one search term.
		will only return the first line that a word is found on
		and does not check for duplicates
	*/
	find(terms) {
		let results = new Array();
		let str = terms.join(" ");
		terms = str.split(" ");

		for(let doc of this.contentList) {
			const title = doc.name;
			let score = 0;
			let firstLine = "";
			
			for(let term of terms) {
				let used = false;
				if(term.length < 2) {
					break;
				}

				for(let line of doc.content) {
					let words = line.split(" ");
					for(let word of words) {
						if(word === term) {
							score++;
							if(!used){
								let str = `: ${doc.content.indexOf(line) +1}`;
								if(firstLine.length < 1)
									firstLine = doc.OG[doc.content.indexOf(line)] + str;
								else {
									if(!(firstLine.slice(-1) === (doc.OG[doc.content.indexOf(line)]).toString()))
										firstLine = firstLine + "\n" + doc.OG[doc.content.indexOf(line)] + str;
								}
								used = true;
							}
						}
					}
				}
			}
			if(score > 0){
				results.push(new Result(title, score, firstLine));
			}
		}
		/* sort results */
		let swaps = false;
		do {
			swaps = false;
			if(results.length < 2)
				break;
			for(let i = 0; i < results.length-1; i++) {
				if(results[i].score < results[i+1].score) {
					let tmp = results[i];
					results[i] = results[i+1];
					results[i+1] = tmp;
					swaps = true;
				} else if(results[i].score === results[i+1].score) {
					if(results[i].name > results[i].name) {
						let tmp = results[i];
						results[i] = results[i+1];
						results[i+1] = tmp;
						swaps = true;
					}
				}
			}
		}while(swaps)
		/* return sorted results */
		return results;
	}

	complete(text) {
		let result = new Array();
		let alphabetic = new RegExp(/[a-zA-Z]/);
		let MAT = new RegExp("\\b"+text);
		if(text.slice(-1).match(alphabetic)) {
			for(let i = 0; i < this.wordList.length; i++) {
				if(this.wordList[i].match(MAT))
					result.push(this.wordList[i]);
			}
			return result;
		}
		return [];
	}
}	//class DocFinder

module.exports = DocFinder;

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple class which packages together the result for a 
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
  return stem(word.toLowerCase()).replace(/[^a-z&^\ ]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
  return word.replace(/\'s$/, '');
}
