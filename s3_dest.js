const s3 = require('./lib/s3');
const combine = require('stream-combiner')
const AWS = require('aws-sdk');


module.exports = function setupS3DestNode(RED) {
	function S3DestNode(config) {
		RED.nodes.createNode(this, config);
		this.path = config.path;
		// eslint-disable-next-line consistent-this
		var node = this;
		node.on('input', function handleInput (msg, send) {
			let configObj = { buffer:false, ...msg.config } // default to streaming mode
			if (msg?.config?.s3)
				configObj.s3 = new AWS.S3(msg.config.s3);

			if (msg.topic && !msg.topic.startsWith('gulp')) {
				this.status({ fill: 'red', shape: 'dot', text: 'missing .src node' });
			} else if (msg.topic == 'gulp-info') {
				// ignore this informational message--but pass it along below
			} else if (msg.topic == 'gulp-initialize') {
				if (!msg.plugins) {
					node.warn('s3.dest: cannot initialize; missing gulp.src?')
					return;
				}

				console.log('s3.dest: creating gulp stream; combining ' + msg.plugins.length + ' plugin streams')
				combine(msg.plugins.map((plugin) => plugin.init()))
					.pipe(s3.dest(node.path, configObj)
						.on('data', (file) => {
							this.status({ fill: 'green', shape: 'dot', text: 'active' });

							// send an info message to announce the file we're processing
							let fileDescription = `${file.history[0].split(/[\\/]/).pop()} -> ${file?.inspect()}`
							msg.payload = `gulpfile: ${fileDescription}`;
							msg.topic = 'gulp-info';
							msg.gulpfile = file;
							// console.log('gulp.dest:', fileDescription)

							send(msg);
						})
						.on('end', () => {
							this.status({ fill: 'green', shape: 'ring', text: 'ready' });
						})

					);

				this.status({ fill: 'green', shape: 'ring', text: 'ready' });
			}

			send(msg);
		});
	}
	RED.nodes.registerType('s3.dest', S3DestNode);
}
