const s3 = require('./lib/s3');
const AWS = require('aws-sdk');

module.exports = function setupS3SrcNode (RED) {
	function S3SrcNode(config) {
		RED.nodes.createNode(this, config);
		this.path = config.path;

		// eslint-disable-next-line consistent-this
		var node = this;
		// console.log('config', config)

		node.on('input', function handleInput(msg, send) {
			let configObj = { buffer:false, ...msg.config } // default to streaming mode
			if (msg?.config?.s3)
				configObj.s3 = new AWS.S3(msg.config.s3);

			/** 
			 * plugins will be an array of objects where obj.init is a function that returns a stream. This clones well for
			 * when msg is cloned by Node-RED (for passing down multiple wires), unlike arrays of streams or other such options
			 */
			msg.plugins = [];

			// set the payload to give info on the gulp stream we're creating
			msg.payload = 's3.src: ' + node.path;
			msg.topic = 'gulp-initialize';

			msg.plugins.push({
				name: config.type,
				// init:() => gulp.src(node.path, configObj)
				init: () => {
					return s3.src(node.path, configObj)
						.on('data', () => {
							this.status({ fill: 'green', shape: 'dot', text: 'active' });
						})
						.on('end', () => {
							this.status({ fill: 'green', shape: 'ring', text: 'ready' });
						})
				}
			})

			send(msg);
		});

	}
	RED.nodes.registerType('s3.src', S3SrcNode);
}
