class CreatePages < ActiveRecord::Migration[8.1]
  def change
    create_table :pages do |t|
      t.string :url, null: false
      t.string :domain
      t.string :title

      t.timestamps
    end

    add_index :pages, :url, unique: true
    add_index :pages, :domain
  end
end
