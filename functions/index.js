const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
const timezoneOptions = {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
};
admin.initializeApp(functions.config().firebase);
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.createUser = functions.auth.user().onCreate(event => {
    const user = event.data;
    
    admin.database().ref(`/users/${user.uid}`).set({
        displayName: user.displayName,
        imageUrl: user.photoURL, 
        totalPoints: 0,
        games: 0,
        level: "beginner",
        createdAt: new Date().toLocaleString([], timezoneOptions),
    });
});



exports.onRoundEnd = functions.database.ref('/rounds/{roundId}/state/')
    .onWrite(event => {
        let isSpyWon = false;
        admin.database().ref(`/rounds/${event.params.roundId}/state`).once('value').then(function(state) {

            console.log("sate " + state.val());

            if(state.val() == "end") {
                
                let maxVotes =0;
                let userMax;
                admin.database().ref(`/rounds/${event.params.roundId}/votes`).once('value').then(function(round) {

                    round.forEach(user => {
          
                        if(user.key != "dummy") {
                            if(user.val() > maxVotes){
                                maxVotes = user.val();
                                userMax = user.key;
                            }
                        }
                    });

                    admin.database().ref(`/rounds/${event.params.roundId}/`).once('value').then(function(roundOfRoom) {
                        //admin.database().ref(`/rooms/${roundOfRoom.roomKey}/`).once('value').then(function(room) {
                            if(roundOfRoom.val().spyKey == userMax) {
                                admin.database().ref(`/rounds/${event.params.roundId}/isSpyWon`).set(false);
                                
                            }
                            else {
                                admin.database().ref(`/rounds/${event.params.roundId}/isSpyWon`).set(true);
                                
                            }

                            let round = roundOfRoom.val();
                            // prepare to room 
                            admin.database().ref(`/rooms/${round.roomKey}/isCategorySelected`).set(false);
                            admin.database().ref(`/rooms/${round.roomKey}/isStarted`).set(false);
                            
                       // });
                    });
                });

            }
        });

        
    })

exports.checkWinner = functions.database.ref('/rounds/{roomKey}/{roundKey}/isAllVoted').onWrite(event => {
    let maxSum = 0;
    let  mostVotedUserKey;
    console.log("checkWinner value " + event.data.val());

    // check if all user voted
    if(event.data.val()) {
        admin.database().ref(`/rounds/${event.params.roomKey}/${event.params.roundKey}/votes`).once('value').then(function(votes) {
            //let users = votes.val();
            
            votes.forEach( t=> {
                console.log("enter to foreach and value is = " + t.val() + " and the key is = " + t.key);
                if(t.val() > maxSum) {
                    maxSum = t.val();
                    mostVotedUserKey = t.key;
                    console.log("the most voted user is (1)" + t.key);
                }
            });
            console.log("the most voted user is " + mostVotedUserKey);
            admin.database().ref(`/rounds/${event.params.roomKey}/${event.params.roundKey}/spyKey`).once('value').then(function(spy) {
                if(spy.val() == mostVotedUserKey) {
                     console.log("the spy is found");
                    admin.database().ref(`/rounds/${event.params.roomKey}/${event.params.roundKey}/spyState`).set("found");
                }
                else {
                    admin.database().ref(`/rounds/${event.params.roomKey}/${event.params.roundKey}/spyState`).set("win");
                }
            });

        });
    }
});
  
  // Keeps track of the length of the 'likes' child list in a separate property.
exports.onUserVoted = functions.database.ref('/rounds/{roomKey}/{roundKey}/votes/{userId}').onWrite(event => {
  const collectionRef = event.data.ref.parent;
  const countRef = collectionRef.parent.child('votesCount');
  let votesCounter;
  // Return the promise from countRef.transaction() so our function 
  // waits for this async event to complete before it exits.
    console.log("the event user id key " + event.params.userId);
    if(event.params.userId == "dummy")
        return;

  return countRef.transaction(current => {
    if (event.data.exists() ) {
      votesCounter = (current || 0) + 1;
    }
    return votesCounter;
  }).then(() => {

    admin.database().ref(`rounds/${event.params.roomKey}/${event.params.roundKey}`).once('value').then(function(round) {
        roomKey = round.val().roomKey; // something wrong here
        //Check if all of the uesers votes        
        admin.database().ref(`rooms/${roomKey}/`).once('value').then(function(room) {
            let usersCount = room.val().usersCount;
            if(usersCount-1 ==  votesCounter) {
                // set that all voted
                admin.database().ref(`rounds/${event.params.roomKey}/${event.params.roundKey}/isAllVoted`).set(true);
            }   
        });
    });
    console.log('Counter updated.');
  });
});