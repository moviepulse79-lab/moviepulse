async function checkUser() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Session error:", error);
        return;
    }

    if (data.session) {
        console.log(
            "MoviePulse user logged in:",
            data.session.user.email
        );
    } else {
        console.log("No MoviePulse user logged in");
    }
}

checkUser();

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth event:", event);

    if (session) {
        console.log(
            "MoviePulse user logged in:",
            session.user.email
        );
    }
});
