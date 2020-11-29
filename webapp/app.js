'use strict';
// node.js packages needed for this application
const http = require('http');
var assert = require('assert');
const express= require('express');
// create Express object used to represent web app
const app = express();
const mustache = require('mustache');
const filesystem = require('fs');
const url = require('url');
const port = Number(process.argv[2]);

const hbase = require('hbase')
// host:'localhost', port:8070
var hclient = hbase({ host: process.argv[3], port: Number(process.argv[4])})


// function rowToMap(row) {
// 	var stats = {}
// 	row.forEach(function (item) {
// 		stats[item['column']] = Number(item['$'])
// 	});
// 	return stats;
// }
// hclient.table('yson_street_by_seg').row('W Washington950').get((error, value) => {
// 	console.info(rowToMap(value))
// 	console.info(value)
// })
//
// hclient.table('spertus_carriers').scan({ maxVersions: 1}, (err,rows) => {
// 	console.info(rows)
// })
//
// hclient.table('spertus_ontime_by_year').scan({
// 	filter: {type : "PrefixFilter",
// 		      value: "AA"},
// 	maxVersions: 1},
// 	(err, value) => {
// 	  console.info(value)
// 	})


app.use(express.static('public'));
app.get('/traffic.html', function (req, res) {
	hclient.table('yson_streets').scan({ maxVersions: 1}, (err,rows) => {
		var template = filesystem.readFileSync("street-results.mustache").toString();
		var html = mustache.render(template, {
			streets : rows
		});
		res.send(html)
	})
});

function removePrefix(text, prefix) {
	return text.substr(prefix.length)
}

app.get('/street-traffic.html',function (req, res) {
	const street = req.query['street'];
	console.log(street); // print street name
	function processSegmentIdRecord(segmentIdRecord) {
		var result = { segment_id : segmentIdRecord['segment_id']};
		["from_street", "to_street", "traffic_direction",
			"speed_month", "speed_week", "speed_day", "speed_hour"].forEach(val => {
			result[val] = segmentIdRecord[val];
		})
		return result;
	}
	function StreetInfo(cells) {
		var result = [];
		var segmentIdRecord;
		cells.forEach(function(cell) {
			var segment_id = Number(removePrefix(cell['key'], street))
			if(segmentIdRecord === undefined)  {
				segmentIdRecord = { segment_id: segment_id }
			} else if (segmentIdRecord['segment_id'] != segment_id ) {
				result.push(processSegmentIdRecord(segmentIdRecord))
				segmentIdRecord = { segment_id: segment_id }
			}
			segmentIdRecord[removePrefix(cell['column'],'stats:')] = cell['$']
		})
		result.push(processSegmentIdRecord(segmentIdRecord))
		// console.log(result) // print street info
		return result;
	}

	hclient.table('yson_street_by_seg').scan({
			filter: {type : "PrefixFilter",
				value: street},
			maxVersions: 1},
		(err, cells) => {
			var si = StreetInfo(cells);
			console.log(si)
			var template = filesystem.readFileSync("submit.mustache").toString();
			var html = mustache.render(template, {
				StreetInfo : si,
				street : street
			});
			res.send(html)

		})
});

app.listen(port);
