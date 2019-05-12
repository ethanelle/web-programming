'use strict';

const axios = require('axios');


function DocsWs(baseUrl) {
  this.docsUrl = `${baseUrl}/docs`;
}

module.exports = DocsWs;

//@TODO add wrappers to call remote web services.

// GET CONTENT
DocsWs.prototype.get = async function(q) {
	try {
		const url = "http://" + this.docsUrl + "/" + q;
		const response = await axios.get(url);
		return response.data;
	} catch (err) {
		console.error(err);
		throw (err.response && err.response.data) ? err.response.data : err;
	}
}

// FIND
DocsWs.prototype.find = async function(terms, start, count) {
	try {
		const trim_terms = terms.replace(/\s/g, "+");
		if(start && count) {
			const url = `http://${this.docsUrl}?q=${trim_terms}&start=${start}&count=${count}`;
			const response = await axios.get(url);	
			return response.data;
		}else if(start) {
			const url = `http://${this.docsUrl}?q=${trim_terms}&start=${start}`;
			const response = await axios.get(url);	
			return response.data;
		}else if(count) {
			const url = `http://${this.docsUrl}?q=${trim_terms}&count=${count}`;
			const response = await axios.get(url);	
			return response.data;
		}else {
			const url = `http://${this.docsUrl}?q=${trim_terms}`;
			const response = await axios.get(url);	
			return response.data;
		}
	} catch (err) {
		console.error(err);
		throw (err.response && err.response.data) ? err.response.data : err;
	}
}

// ADD CONTENT
DocsWs.prototype.create = async function(name, content) {
	try {
		const url = "http://" + this.docsUrl;
		const body = {
			name : name,
			content : content
		};
		axios.post(url, body).then(function(response) {
			return response.data;
		});
	} catch (err) {
		console.error(err);
		throw (err.response && err.response.data) ? err.response.data : err;
	}
}