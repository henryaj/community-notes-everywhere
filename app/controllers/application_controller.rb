class ApplicationController < ActionController::API
  private

  def current_user
    @current_user ||= User.find_by(auth_token: bearer_token) if bearer_token
  end

  def authenticate!
    render json: { error: "Unauthorized" }, status: :unauthorized unless current_user
  end

  def bearer_token
    request.headers["Authorization"]&.match(/^Bearer (.+)$/)&.captures&.first
  end
end
