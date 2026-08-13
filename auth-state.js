supabaseClient.auth.onAuthStateChange((event, session) => {

    if (session) {

        console.log("MoviePulse user logged in:", session.user.email);

    } else {

        console.log("No MoviePulse user logged in");

    }

});
