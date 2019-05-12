<!DOCTYPE html>

<html>
<head>
	<title>Docfinder Home</title>
</head>
<body>

	<h1>Search Documents</h1>
	<form action="/docs/search/" method="GET">
		<span class="label">Search term:</span>
		<input type="text" id="query" name="query" value="{{query}}">
		<input type="submit" value="search">
	</form>

	<div class="results">
		<h2>Search Results</h2>
		<ul>
			{{#results}}
			<li>
				<a href="{{base}}/{{name}}">{{name}}</a> <br>
				{{#lines}}
				<p style="display:inline-block">{{p1}}</p> <p style="display:inline-block; color: green">{{term}}</p> <p style="display:inline-block">{{p2}}</p>
				{{/lines}}
			</li>
			{{/results}}
		</ul>
		{{#links}}
		<p><a href="{{href}}">{{rel}}</a></p>
		{{/links}}
	</div>

	<footer>
		<ul style="list-style: none;">
			<li style="display: inline"><a href="/docs">Home</a></li> |
			<li style="display: inline"><a href="/docs/search">Search</a></li> |
			<li style="display: inline"><a href="/docs/add_document">Add Document</a></li>
		</ul>
	</footer>

</body>
</html>