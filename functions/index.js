/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const functions = require('firebase-functions');
const { WebhookClient } = require('dialogflow-fulfillment');
const { google } = require('googleapis');

const sheets = google.sheets('v4');
process.env.DEBUG = 'dialogflow:debug';

const serviceAccount = {};   // Enter Service Account private key JSON

const client = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
});

const timeZone = 'America/Los_Angeles';
const timeZoneOffset = '-07:00';

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function makeRes(agent) {
    let [date, time, name, group, phone] = [agent.parameters.date, agent.parameters.time,
    agent.parameters.name, agent.parameters.groupN,
    agent.parameters.phone];

    let shortDate = date.slice(0, 10);           //converts ISO formatting to readable params
    let shortTime = time.slice(11, 16);

    // Google Sheets URL: https://docs.google.com/spreadsheets/d/__SPREADSHEETID__/
    // Go to Google Sheets URL and be sure to share directly with your Service Account client_email 
    return new Promise((resolve, reject) => {
      client.authorize((err, tokens) => {
        const sheets = google.sheets('v4');

        sheets.spreadsheets.values.append({
          auth: client,
          spreadsheetId: ' ',             // Enter your spreadsheetId here
          range: 'Sheet1!A1:F1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [
              [`${shortDate}`, `${shortTime}`, `${name}`, `${group}`, `${phone}`]
            ]
          }
        }, (e, reservation) => e ? reject(e) : resolve(reservation));

      });
    }).then(() => {
      response.json({
        'fulfillmentText': `Perfect I've got you down for ${shortDate} at ${shortTime}, see you later!`
      });

      // // instead you can only use full response object if you want to respond with ssml or call transfer
      // const responseObject = {
      //   'fulfillmentText': `Perfect I've got you down for ${shortDate} at ${shortTime}, see you later!`,
      //   "fulfillmentMessages": [
      //     {
      //       "platform": "TELEPHONY",
      //       "telephonySynthesizeSpeech": {
      //         "ssml":
      //           `<speak>
      //               voice Perfect I've got you down for ${shortDate} at ${shortTime}
      //               <break time=0.2s />
      //               see you later!
      //             </speak>`
      //       }
      //     },
      //     // {
      //     //   "platform": "TELEPHONY",
      //     //   "telephonyTransferCall": {
      //     //     "phoneNumber": "+1989XXXXXX" //E.164 format phone number, US only at this point
      //     //   }
      //     // },
      //     {
      //       "text":
      //         { "text": [`text Perfect I've got you down for ${shortDate} at ${shortTime}, see you later!`] }
      //     }
      //   ]
      // };
      // response.json(responseObject);


    }).catch(() => {
      agent.add(`I'm sorry I'm not able to take down your reservation but you'll be connected to the main line in a moment`);
      let callEvent = agent.setFollowupEvent('call_transfer_event');
    });
  }


  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('makeRes', makeRes);
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
