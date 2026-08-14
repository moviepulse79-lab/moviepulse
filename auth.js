let isLoginMode = true;

const authForm = document.getElementById("authForm");
const authButton = document.getElementById("authButton");
const authMessage = document.getElementById("authMessage");

const switchAuth = document.getElementById("switchAuth");
const switchQuestion = document.getElementById("switchQuestion");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {

    if (password.type === "password") {

        password.type = "text";
        togglePassword.textContent = "Hide";

    } else {

        password.type = "password";
        togglePassword.textContent = "Show";

    }

});
// ===============================
// SWITCH LOGIN / CREATE ACCOUNT
// ===============================

switchAuth.addEventListener("click", () => {

    isLoginMode = !isLoginMode;

    authMessage.textContent = "";

    if (isLoginMode) {

        // LOGIN MODE

        authTitle.textContent = "Welcome Back";

        authSubtitle.textContent =
            "Sign in to continue to MoviePulse";

        authButton.textContent = "Sign In";

        switchQuestion.textContent =
            "Don't have an account?";

        switchAuth.textContent =
            "Create Account";

    } else {

        // CREATE ACCOUNT MODE

        authTitle.textContent =
            "Create Your Account";

        authSubtitle.textContent =
            "Join MoviePulse and save your favorite movies";

        authButton.textContent =
            "Create Account";

        switchQuestion.textContent =
            "Already have an account?";

        switchAuth.textContent =
            "Sign In";

    }

});


// ===============================
// LOGIN / SIGN UP
// ===============================

authForm.addEventListener("submit", async (e) => {

    e.preventDefault();


    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;


    if (!email || !password) {

        authMessage.textContent =
            "Please enter your email and password.";

        return;

    }


    authMessage.textContent =
        "Please wait...";


    authButton.disabled = true;


    try {

        // =========================
        // LOGIN
        // =========================

        if (isLoginMode) {

            const {
                data,
                error
            } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });


            if (error) throw error;


            authMessage.textContent =
                "Login successful!";


            console.log(
                "Logged in:",
                data.user
            );


            setTimeout(() => {

                window.location.href =
                    "index.html";

            }, 1000);


        }


        // =========================
        // CREATE ACCOUNT
        // =========================

        else {

            const {
                data,
                error
            } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    emailRedirectTo:
                        "https://moviepulse247.netlify.app/auth.html"

                }

            });


            if (error) throw error;


            authMessage.textContent =
                "Account created! Check your email to confirm your account.";


            console.log(
                "Signed up:",
                data.user
            );

        }


    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );


        authMessage.textContent =
            error.message;


    } finally {

        authButton.disabled = false;

    }

});
// ===============================
// FORGOT PASSWORD
// ===============================

const forgotPassword =
    document.getElementById("forgotPassword");


forgotPassword.addEventListener("click", async (e) => {

    e.preventDefault();

    const email =
        document.getElementById("email").value.trim();


    if (!email) {

        authMessage.textContent =
            "Enter your email address first.";

        document.getElementById("email").focus();

        return;
    }


    authMessage.textContent =
        "Sending password reset email...";


    try {

        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        "https://moviepulse247.netlify.app/reset-password.html"
                }
            );


        if (error) throw error;


        authMessage.textContent =
            "Password reset email sent! Check your inbox.";

    }


    catch (error) {

        console.error(
            "Password reset error:",
            error
        );

        authMessage.textContent =
            error.message;

    }

});
