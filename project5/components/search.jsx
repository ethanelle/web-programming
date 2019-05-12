//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Search extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   */
  constructor(props) {
    super(props);

    const infos = this.infos = props.infos;
    this.state = {
      submitted: false,
      terms: "",
      results: {}
    };

    
    this.parentService = props.app;
    this.onBlur = this.onBlur.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  async onSubmit(event) {
    event.preventDefault();
    
    if(this.state.terms !== '') {
      const terms = this.state.terms;
      const updated = await this.parentService.ws.searchDocs(terms);
      this.setState({results: updated, submitted: true});
    }
  }

  async onBlur(event) {
    event.preventDefault();

    if(this.state.terms !== '') {
      const terms = this.state.terms;
      const updated = await this.parentService.ws.searchDocs(terms);
      this.setState({results: updated, submitted: true});
    }
  }

  onChange(event) {
    this.setState({terms: event.target.value, submitted: false});
  }

  handleClick(event, name) {
    console.log("A link was clicked: " + name);
    this.parentService.setState({contentName: name});
  }

  render() {
    let results = [];
    
    if(Object.keys(this.state.results).length !== 0) {
      const resArr = this.state.results.results;
      
      const terms = this.state.terms.split(" ")[0];
      if(this.state.submitted) {
        for(let i = 0; i < resArr.length; i++) {
          let REGEX = new RegExp("\s?"+terms+"\s?", "i");
          let line = resArr[i].lines[0];
          const matchedIndex = line.match(REGEX).index;
          let arr = [];
          arr.push(line.substring(0, matchedIndex));
          arr.push(line.substring(matchedIndex, matchedIndex + terms.length));
          arr.push(line.substring(matchedIndex + terms.length));

          let fixed = resArr[i].lines.map((e, i) => <LineItem key={i} first={arr[0]} second={arr[1]} third={arr[2]} />)
          resArr[i].lines = fixed;
        }
      }

      results = resArr.map((x, i) => 
        <ListItem key={i} name={x.name} line={x.lines} clickHanlder={this.handleClick} />);
    }

    return (
      <div className="searchTab">
        <div className="form">
          <form onSubmit={this.onSubmit} >
            Search: <input type="text/submit" placeholder="search terms" 
            value={this.state.val} onChange={this.onChange} onBlur={this.onBlur} />
            <span className="error">{this.state.error}</span>
          </form>
        </div>
        <div className="results">
          <ul>
            {results }
          </ul>
        </div>
      </div>
    );
  }

}

module.exports = Search;

function ListItem(props) {
  return (
    <li className="result">
      <a className="result-name" href="#" onClick={((e) => props.clickHanlder(e, props.name))}>{props.name}</a>
      <div>{props.line }</div>
    </li>
    );
}

const styleOne = {
  color: 'green'
}

function LineItem(props) {
  return (
      <div>{props.first }<span style={styleOne} className="term-fresh">{props.second }</span>{props.third }</div>
    );
}