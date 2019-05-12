//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Add extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   */
  constructor(props) {
    super(props);

    this.state = {
      name: "",
      contents: ""
    }

    this.parentService = props.app;
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
  }

  //@TODO add code

  //Note that a you can get information on the file being uploaded by
  //hooking the change event on <input type="file">.  It will have
  //event.target.files[0] set to an object containing information
  //corresponding to the uploaded file.  You can get the contents
  //of the file by calling the provided readFile() function passing
  //this object as the argument.

  async onChange(event) {
    const file = event.target.files[0];
    const processedFile = await readFile(file);
    const title = file.name.substring(0,file.name.length - 4);
    this.setState({name: title, contents: processedFile});
  }

  async onSubmit(event) {
    event.preventDefault();

    const title = this.state.name;
    const contents = this.state.contents;
    const results = await this.parentService.ws.addContent(title, contents);

    this.parentService.setState({contentName: title});
  }


  render() {
    return (
      <div className="add">
        <form onSubmit={this.onSubmit}>
          Upload file: <input type="file" onChange={this.onChange} /><br />
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }

}

module.exports = Add;

/** Return contents of file (of type File) read from user's computer.
 *  The file argument is a file object corresponding to a <input
 *  type="file"/>
 */
async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>  resolve(reader.result);
    reader.readAsText(file);
  });
}
