async function updateUserMenu(session) {

    const loginLink = document.getElementById("loginLink");
    const signupLink = document.getElementById("signupLink");
    const logoutLink = document.getElementById("logoutLink");

    if (!loginLink || !signupLink || !logoutLink) return;


    if (session) {

        // User is logged in
        loginLink.style.display = "none";
        signupLink.style.display = "none";
        logoutLink.style.display = "block";

        console.log(
            "MoviePulse user logged in:",
            session.user.email
        );

    } else {

        // User is logged out
        loginLink.style.display = "block";
        signupLink.style.display = "block";
        logoutLink.style.display = "none";

        console.log("No MoviePulse user logged in");

    }
}


// Check current login session
async function checkUser() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {

        console.error("Session error:", error);
        return;

    }

    updateUserMenu(data.session);

}

checkUser();


// Detect login/logout automatically
supabaseClient.auth.onAuthStateChange((event, session) => {

    console.log("Auth event:", event);

    updateUserMenu(session);

});


// Logout
const logoutLink = document.getElementById("logoutLink");

if (logoutLink) {

    logoutLink.addEventListener("click", async () => {

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {

            console.error("Logout error:", error);
            return;

        }

        window.location.href = "index.html";

    });

}
