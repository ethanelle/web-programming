//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Content extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   *  name:Name of document to be displayed.
   */
  constructor(props) {
    super(props);
    
    this.parentService = props;
    this.state = {
      title: "",
      content: ""
    };

    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentDidUpdate = this.componentDidUpdate.bind(this);
  }

  //@TODO

  componentDidMount() {
    if(this.parentService.app.state.contentName !== "") {
      const name = this.parentService.app.state.contentName;
      this.state.title = name;

      this.loadContents((err, contents) => {
        if(err) throw err;
        this.setState({content: contents.content});  
      });
    }
  }

  componentDidUpdate(prevProps) {
    if((this.parentService.app.state.contentName !== "") && (prevProps.name !== this.parentService.name)) {
      const name = this.parentService.app.state.contentName;
      this.state.title = name;

      this.loadContents((err, contents) => {
        if(err) throw err;
        this.setState({content: contents.content});  
      });
    }
  }

  async loadContents(callback) {
    const name = this.state.title;
    const content = await this.parentService.app.ws.getContent(name);
    callback(null, content);
  }

  render() {
    //@TODO
    const contents = this.state.content;
    const title = this.state.title;
    return (
      <div>
        <h1>{title}</h1>
        <p>{contents}</p>
      </div>
    );
  }

}

module.exports = Content;
