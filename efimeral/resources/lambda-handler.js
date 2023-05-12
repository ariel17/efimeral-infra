const AWS = require('aws-sdk');

exports.handler = async (event, context) => {
  try {
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Container created',
      })
    };
  
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating container',
        error: err.body,
      })
    };
  }
};