class AuthController < ApplicationController
  # GET /auth/x/callback — real OAuth
  def callback
    auth = request.env["omniauth.auth"]
    user = User.find_or_create_from_oauth(auth)
    redirect_to_extension(user)
  end

  # GET /auth/dev?user=handle — dev-only login
  # Pass ?user=handle to log in as an existing user (preserves DB reputation).
  # Without the param, creates/updates a default dev_tester account.
  def dev
    raise ActionController::RoutingError, "Not Found" unless Rails.env.development?

    if params[:user].present?
      user = User.find_by!(twitter_handle: params[:user])
    else
      user = User.find_or_initialize_by(twitter_uid: "dev_user")
      user.assign_attributes(
        twitter_handle: "dev_tester",
        display_name: "Dev Tester",
        avatar_url: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
        follower_count: 500,
        account_created_at: 3.years.ago
      )
      user.save!
      user.recalculate_reputation!
    end

    redirect_to_extension(user)
  end

  def failure
    render json: { error: "Authentication failed", reason: params[:message] }, status: :unauthorized
  end

  private

  def redirect_to_extension(user)
    # Render a page that stores the token and confirms login
    render html: <<~HTML.html_safe
      <!DOCTYPE html>
      <html>
      <head><title>Login Successful</title></head>
      <body>
        <h1>Login successful!</h1>
        <p id="status">Sending credentials to extension...</p>
        <script>
          const token = "#{user.auth_token}";
          const userData = {
            id: #{user.id},
            handle: "#{user.twitter_handle}",
            displayName: "#{user.display_name}",
            avatarUrl: "#{user.avatar_url}"
          };

          // The extension's background worker listens for this URL pattern
          // and reads the token from the hash fragment
          const hashData = encodeURIComponent(JSON.stringify({ token, user: userData }));
          window.location.hash = "cne_auth=" + hashData;

          document.getElementById("status").textContent =
            "Logged in as @#{user.twitter_handle}. You can close this tab.";
        </script>
      </body>
      </html>
    HTML
  end
end
