let isLoginMode = true;

const authForm = document.getElementById("authForm");
const authButton = document.getElementById("authButton");
const authMessage = document.getElementById("authMessage");

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");


// Switch to Login
loginTab.addEventListener("click", () => {

    isLoginMode = true;

    loginTab.classList.add("active");
    signupTab.classList.remove("active");

    authButton.textContent = "Login";
    authMessage.textContent = "";

});


// Switch to Sign Up
signupTab.addEventListener("click", () => {

    isLoginMode = false;

    signupTab.classList.add("active");
    loginTab.classList.remove("active");

    authButton.textContent = "Create Account";
    authMessage.textContent = "";

});


// Login / Sign Up
authForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    authMessage.textContent = "Please wait...";

    try {

        if (isLoginMode) {

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            authMessage.textContent = "Login successful!";

            console.log("Logged in:", data.user);

        } else {

            const { data, error } =
                await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });

            if (error) throw error;

            authMessage.textContent =
                "Account created! Check your email to confirm your account.";

            console.log("Signed up:", data.user);

        }

    } catch (error) {

        console.error(error);

        authMessage.textContent = error.message;

    }

});
