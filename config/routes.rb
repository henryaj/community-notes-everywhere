Rails.application.routes.draw do
  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  # Pages
  root "pages#home"
  get "/privacy", to: "pages#privacy"
  get "/terms", to: "pages#terms"

  # OAuth
  get "/auth/x/callback", to: "auth#callback"
  get "/auth/dev", to: "auth#dev"
  get "/auth/failure", to: "auth#failure"

  # API
  namespace :api do
    resources :notes, only: [:index, :create, :update, :destroy] do
      resource :ratings, only: [:create]
      resources :reports, only: [:create]
    end
    get :me, to: "me#show"
  end
end
