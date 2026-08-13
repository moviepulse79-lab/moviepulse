let isLoginMode = true;

const authForm = document.getElementById("authForm");
const authButton = document.getElementById("authButton");
const authMessage = document.getElementById("authMessage");

const switchAuth = document.getElementById("switchAuth");
const switchQuestion = document.getElementById("switchQuestion");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");


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
